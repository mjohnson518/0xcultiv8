// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IEIP8004Agent.sol";

/**
 * @title Cultiv8Agent
 * @notice EIP-8004 compliant trustless agent for yield farming automation
 * @dev First implementation of EIP-8004 standard for DeFi yield optimization
 * 
 * Key Features:
 * - On-chain authorization with revocable permissions
 * - Per-transaction and daily spending limits
 * - Protocol whitelist for security
 * - Function selector whitelist (defense-in-depth)
 * - Event-based execution history (gas efficient, index off-chain)
 * - Instant revocation capability
 * 
 * Security:
 * - Users maintain full control of their funds
 * - Agent can only execute within authorized limits
 * - All executions recorded for transparency
 * - Emergency pause mechanism
 */
contract Cultiv8Agent is IEIP8004Agent, Ownable, ReentrancyGuard {
    
    /// @notice User authorizations mapping
    mapping(address => AgentAuthorization) public authorizations;

    /// @notice Whitelisted protocols the agent can interact with
    mapping(address => bool) public whitelistedProtocols;

    /// @notice Allowed function selectors per protocol (protocol => selector => allowed)
    /// @dev SECURITY: Prevents arbitrary calldata execution - only whitelisted operations permitted
    mapping(address => mapping(bytes4 => bool)) public allowedSelectors;

    /// @notice Total executions counter (gas efficient, replaces unbounded array)
    /// @dev Full execution details available via AgentExecuted events - index off-chain
    uint256 public totalExecutions;
    
    /// @notice Emergency pause state
    bool public paused;
    
    /// @notice Minimum authorization amounts
    uint256 public constant MIN_AUTHORIZATION = 100 * 1e6; // $100 USDC (6 decimals)
    
    /// @notice Maximum authorization amounts
    uint256 public constant MAX_AUTHORIZATION = 1000000 * 1e6; // $1M USDC

    /// @notice Blocks per day (~7200 at 12s block time on Ethereum mainnet)
    /// @dev Using block numbers instead of timestamps prevents miner manipulation
    uint256 public constant BLOCKS_PER_DAY = 7200;

    /// @notice Authorized vault that can record spending on behalf of users
    /// @dev Required for EIP-7702 delegated execution flow
    address public authorizedVault;

    /// @notice Emitted when authorized vault is updated
    event AuthorizedVaultUpdated(address indexed oldVault, address indexed newVault);

    /// @notice Emitted when a function selector is whitelisted for a protocol
    event SelectorWhitelisted(address indexed protocol, bytes4 indexed selector, bool allowed);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Set the authorized vault address
     * @dev Only the vault can call recordSpending
     * @param vault Address of the AgentVault contract
     */
    function setAuthorizedVault(address vault) external onlyOwner {
        require(vault != address(0), "Invalid vault address");
        address oldVault = authorizedVault;
        authorizedVault = vault;
        emit AuthorizedVaultUpdated(oldVault, vault);
    }
    
    /**
     * @notice Authorize the Cultiv8 agent to execute strategies
     * @param agent Address of the agent (Cultiv8 backend)
     * @param maxAmountPerTx Maximum amount agent can move in single transaction
     * @param dailyLimit Maximum total amount agent can move per day
     */
    function authorizeAgent(
        address agent,
        uint256 maxAmountPerTx,
        uint256 dailyLimit
    ) external {
        require(!paused, "Contract is paused");
        require(agent != address(0), "Invalid agent address");
        require(maxAmountPerTx >= MIN_AUTHORIZATION, "Amount too small");
        require(maxAmountPerTx <= MAX_AUTHORIZATION, "Amount too large");
        require(dailyLimit >= maxAmountPerTx, "Daily limit must >= per-tx limit");
        require(dailyLimit <= MAX_AUTHORIZATION, "Daily limit too large");
        
        authorizations[msg.sender] = AgentAuthorization({
            agent: agent,
            maxAmountPerTx: maxAmountPerTx,
            dailyLimit: dailyLimit,
            dailySpent: 0,
            lastResetDay: block.number / BLOCKS_PER_DAY,
            active: true,
            authorizedAt: block.timestamp
        });
        
        emit AgentAuthorized(msg.sender, agent, maxAmountPerTx, dailyLimit);
    }
    
    /**
     * @notice Execute a yield farming strategy on behalf of user
     * @dev Only callable by authorized agent, within spending limits
     * @param user User whose funds are being managed
     * @param protocol Target protocol address
     * @param strategyData Encoded strategy execution data
     * @param amount Amount to be moved
     * @return success Whether execution succeeded
     */
    function executeStrategy(
        address user,
        address protocol,
        bytes calldata strategyData,
        uint256 amount
    ) external nonReentrant returns (bool success) {
        require(!paused, "Contract is paused");
        
        AgentAuthorization storage auth = authorizations[user];
        
        // Verify authorization
        require(auth.active, "Agent not authorized");
        require(auth.agent == msg.sender, "Unauthorized agent");
        require(amount > 0, "Amount must be positive");
        require(amount <= auth.maxAmountPerTx, "Exceeds per-transaction limit");
        require(whitelistedProtocols[protocol], "Protocol not whitelisted");
        require(strategyData.length >= 4, "Invalid calldata");

        // SECURITY: Extract and validate function selector against whitelist
        // Prevents arbitrary calldata execution even on whitelisted protocols
        bytes4 selector = bytes4(strategyData[:4]);
        require(allowedSelectors[protocol][selector], "Function not whitelisted");

        // Check and update daily limit using block numbers (prevents timestamp manipulation)
        uint256 currentDay = block.number / BLOCKS_PER_DAY;
        if (currentDay > auth.lastResetDay) {
            auth.dailySpent = 0;
            auth.lastResetDay = currentDay;
        }

        require(auth.dailySpent + amount <= auth.dailyLimit, "Exceeds daily limit");
        auth.dailySpent += amount;

        // Execute strategy via low-level call
        bytes32 strategyHash = keccak256(strategyData);
        (success, ) = protocol.call(strategyData);

        // Increment execution counter (gas efficient, replaces unbounded array)
        // Full execution details are indexed from AgentExecuted events
        unchecked { totalExecutions++; }

        emit AgentExecuted(user, protocol, amount, strategyHash, success);

        require(success, "Strategy execution failed");
        return success;
    }
    
    /**
     * @notice Revoke agent authorization immediately
     * @dev User can always revoke, regardless of active positions
     */
    function revokeAgent() external {
        AgentAuthorization storage auth = authorizations[msg.sender];
        require(auth.active, "Agent not active");
        
        auth.active = false;
        emit AgentRevoked(msg.sender, auth.agent);
    }
    
    /**
     * @notice Update spending limits for existing authorization
     * @param maxAmountPerTx New per-transaction limit
     * @param dailyLimit New daily limit
     */
    function updateLimits(uint256 maxAmountPerTx, uint256 dailyLimit) external {
        AgentAuthorization storage auth = authorizations[msg.sender];
        require(auth.active, "Agent not authorized");
        require(maxAmountPerTx >= MIN_AUTHORIZATION, "Amount too small");
        require(maxAmountPerTx <= MAX_AUTHORIZATION, "Amount too large");
        require(dailyLimit >= maxAmountPerTx, "Daily limit must >= per-tx limit");
        require(dailyLimit <= MAX_AUTHORIZATION, "Daily limit too large");
        
        auth.maxAmountPerTx = maxAmountPerTx;
        auth.dailyLimit = dailyLimit;
        
        emit AgentAuthorized(msg.sender, auth.agent, maxAmountPerTx, dailyLimit);
    }
    
    /**
     * @notice Admin function to whitelist protocols
     * @param protocol Protocol address to whitelist
     * @param status true to whitelist, false to remove
     */
    function setProtocolWhitelist(address protocol, bool status) external onlyOwner {
        require(protocol != address(0), "Invalid protocol address");
        whitelistedProtocols[protocol] = status;
        emit ProtocolWhitelisted(protocol, status);
    }
    
    /**
     * @notice Emergency pause mechanism
     * @param _paused true to pause, false to unpause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }
    
    /**
     * @notice Get authorization details for a user
     * @param user User address to query
     * @return Authorization struct
     */
    function getAuthorization(address user) external view returns (AgentAuthorization memory) {
        return authorizations[user];
    }
    
    /**
     * @notice Get total execution count
     * @dev Full execution history is available via AgentExecuted events (index off-chain)
     * @return Number of executions performed
     */
    function getExecutionHistoryLength() external view returns (uint256) {
        return totalExecutions;
    }

    /**
     * @notice Whitelist a function selector for a protocol
     * @dev SECURITY: Only whitelisted selectors can be called via executeStrategy
     * @param protocol Protocol address
     * @param selector Function selector (first 4 bytes of keccak256 of signature)
     * @param allowed true to allow, false to disallow
     */
    function setSelectorWhitelist(
        address protocol,
        bytes4 selector,
        bool allowed
    ) external onlyOwner {
        require(protocol != address(0), "Invalid protocol address");
        require(selector != bytes4(0), "Invalid selector");
        allowedSelectors[protocol][selector] = allowed;
        emit SelectorWhitelisted(protocol, selector, allowed);
    }

    /**
     * @notice Batch whitelist function selectors for a protocol
     * @param protocol Protocol address
     * @param selectors Array of function selectors
     * @param statuses Array of allowed statuses
     */
    function batchSetSelectorWhitelist(
        address protocol,
        bytes4[] calldata selectors,
        bool[] calldata statuses
    ) external onlyOwner {
        require(protocol != address(0), "Invalid protocol address");
        require(selectors.length == statuses.length, "Length mismatch");
        for (uint256 i = 0; i < selectors.length; i++) {
            require(selectors[i] != bytes4(0), "Invalid selector");
            allowedSelectors[protocol][selectors[i]] = statuses[i];
            emit SelectorWhitelisted(protocol, selectors[i], statuses[i]);
        }
    }

    /**
     * @notice Check if a function selector is allowed for a protocol
     * @param protocol Protocol address
     * @param selector Function selector
     * @return Whether the selector is whitelisted
     */
    function isSelectorAllowed(address protocol, bytes4 selector) external view returns (bool) {
        return allowedSelectors[protocol][selector];
    }
    
    /**
     * @notice Check if agent can execute given amount for user
     * @param user User address
     * @param amount Amount to check
     * @return canExecute Whether execution is permitted
     */
    function canExecute(address user, uint256 amount) external view returns (bool) {
        AgentAuthorization storage auth = authorizations[user];

        if (paused || !auth.active || amount > auth.maxAmountPerTx) {
            return false;
        }

        uint256 currentDay = block.number / BLOCKS_PER_DAY;
        uint256 dailySpent = (currentDay > auth.lastResetDay) ? 0 : auth.dailySpent;

        return (dailySpent + amount <= auth.dailyLimit);
    }
    
    /**
     * @notice Get user's remaining daily limit
     * @param user User address
     * @return remaining Amount remaining for today
     */
    function getRemainingDailyLimit(address user) external view returns (uint256 remaining) {
        AgentAuthorization storage auth = authorizations[user];

        if (!auth.active) return 0;

        uint256 currentDay = block.number / BLOCKS_PER_DAY;
        uint256 dailySpent = (currentDay > auth.lastResetDay) ? 0 : auth.dailySpent;

        return auth.dailyLimit > dailySpent ? auth.dailyLimit - dailySpent : 0;
    }

    /**
     * @notice Record spending from authorized vault (for EIP-7702 delegated execution)
     * @dev Only callable by the authorized vault contract
     * SECURITY: Validates both vault caller AND agent authorization for defense-in-depth
     * @param user User whose spending to record
     * @param protocol Target protocol (for event logging)
     * @param amount Amount spent
     * @param strategyHash Hash of the executed strategy data
     * @param executingAgent The agent that initiated the vault call (validated by vault, verified here)
     */
    function recordSpending(
        address user,
        address protocol,
        uint256 amount,
        bytes32 strategyHash,
        address executingAgent
    ) external nonReentrant {
        require(!paused, "Contract is paused");
        require(msg.sender == authorizedVault, "Only authorized vault");
        require(authorizedVault != address(0), "Vault not configured");

        AgentAuthorization storage auth = authorizations[user];

        // SECURITY: Verify authorization is active AND the executing agent matches
        // Defense-in-depth: vault validates this too, but we double-check
        require(auth.active, "Agent not authorized");
        require(auth.agent == executingAgent, "Agent mismatch");
        require(amount > 0, "Amount must be positive");
        require(amount <= auth.maxAmountPerTx, "Exceeds per-transaction limit");
        require(whitelistedProtocols[protocol], "Protocol not whitelisted");

        // Check and update daily limit using block numbers
        uint256 currentDay = block.number / BLOCKS_PER_DAY;
        if (currentDay > auth.lastResetDay) {
            auth.dailySpent = 0;
            auth.lastResetDay = currentDay;
        }

        require(auth.dailySpent + amount <= auth.dailyLimit, "Exceeds daily limit");
        auth.dailySpent += amount;

        // Increment execution counter (gas efficient, replaces unbounded array)
        // Full execution details are indexed from AgentExecuted events
        unchecked { totalExecutions++; }

        emit AgentExecuted(user, protocol, amount, strategyHash, true);
    }
}

