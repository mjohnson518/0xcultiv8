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
 * - Full execution history on-chain
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
    
    /// @notice Execution history for transparency
    ExecutionRecord[] public executionHistory;
    
    /// @notice Whitelisted protocols the agent can interact with
    mapping(address => bool) public whitelistedProtocols;
    
    /// @notice Emergency pause state
    bool public paused;
    
    /// @notice Minimum authorization amounts
    uint256 public constant MIN_AUTHORIZATION = 100 * 1e6; // $100 USDC (6 decimals)
    
    /// @notice Maximum authorization amounts  
    uint256 public constant MAX_AUTHORIZATION = 1000000 * 1e6; // $1M USDC
    
    constructor() Ownable(msg.sender) {}
    
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
            lastResetDay: block.timestamp / 1 days,
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
        
        // Check and update daily limit
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > auth.lastResetDay) {
            auth.dailySpent = 0;
            auth.lastResetDay = currentDay;
        }
        
        require(auth.dailySpent + amount <= auth.dailyLimit, "Exceeds daily limit");
        auth.dailySpent += amount;
        
        // Execute strategy via low-level call
        bytes32 strategyHash = keccak256(strategyData);
        (success, ) = protocol.call(strategyData);
        
        // Record execution
        executionHistory.push(ExecutionRecord({
            user: user,
            protocol: protocol,
            amount: amount,
            strategyHash: strategyHash,
            timestamp: block.timestamp,
            success: success
        }));
        
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
     * @notice Get execution history length
     * @return Number of recorded executions
     */
    function getExecutionHistoryLength() external view returns (uint256) {
        return executionHistory.length;
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
        
        uint256 currentDay = block.timestamp / 1 days;
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
        
        uint256 currentDay = block.timestamp / 1 days;
        uint256 dailySpent = (currentDay > auth.lastResetDay) ? 0 : auth.dailySpent;
        
        return auth.dailyLimit > dailySpent ? auth.dailyLimit - dailySpent : 0;
    }
}

