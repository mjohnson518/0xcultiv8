// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IEIP7702Vault.sol";
import "./interfaces/IEIP8004Agent.sol";

/**
 * @title AgentVault
 * @notice EIP-7702 compatible vault for user fund management
 * @dev Supports temporary code delegation for gasless agent operations
 * 
 * Key Features:
 * - Secure USDC custody
 * - EIP-7702 delegated execution support
 * - Emergency pause mechanism
 * - Per-user balance tracking
 */
contract AgentVault is IEIP7702Vault, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    /// @notice USDC token address
    IERC20 public immutable usdc;

    /// @notice Authorized Cultiv8 agent contract (EIP-8004)
    IEIP8004Agent public immutable cultiv8Agent;
    
    /// @notice User balances
    mapping(address => uint256) public balances;

    /// @notice Emergency pause state
    bool public paused;

    /// @notice Whitelisted protocols the vault can interact with
    mapping(address => bool) public whitelistedProtocols;

    /// @notice Allowed function selectors per protocol (protocol => selector => allowed)
    /// @dev Prevents arbitrary calldata execution - only whitelisted operations permitted
    mapping(address => mapping(bytes4 => bool)) public allowedSelectors;

    /// @notice Minimum deposit amount
    uint256 public constant MIN_DEPOSIT = 10 * 1e6; // $10 USDC

    /// @notice Emitted when a function selector is whitelisted for a protocol
    event SelectorWhitelisted(address indexed protocol, bytes4 indexed selector, bool allowed);
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    constructor(address _usdc, address _cultiv8Agent) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_cultiv8Agent != address(0), "Invalid agent address");
        usdc = IERC20(_usdc);
        cultiv8Agent = IEIP8004Agent(_cultiv8Agent);
    }
    
    /**
     * @notice Deposit USDC into vault
     * @param amount Amount of USDC to deposit (6 decimals)
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_DEPOSIT, "Amount below minimum");
        
        balances[msg.sender] += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        emit Deposited(msg.sender, amount);
    }
    
    /**
     * @notice Withdraw USDC from vault
     * @param amount Amount of USDC to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        usdc.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @notice Execute delegated call (EIP-7702 support)
     * @dev Allows authorized agent to execute strategies on behalf of users
     * SECURITY: Verifies per-user authorization via Cultiv8Agent contract
     * SECURITY: Validates calldata against whitelisted function selectors
     * SECURITY: Records spending in Cultiv8Agent for daily limit enforcement
     * @param user User whose funds/authorization are being used
     * @param target Target contract to call
     * @param amount Amount being transacted (for limit tracking)
     * @param data Calldata to execute
     * @return result Return data from call
     */
    function executeDelegated(
        address user,
        address target,
        uint256 amount,
        bytes calldata data
    ) external nonReentrant whenNotPaused returns (bytes memory result) {
        require(target != address(0), "Invalid target");
        require(whitelistedProtocols[target], "Protocol not whitelisted");
        require(user != address(0), "Invalid user address");
        require(data.length >= 4, "Invalid calldata");

        // SECURITY: Extract and validate function selector against whitelist
        bytes4 selector = bytes4(data[:4]);
        require(allowedSelectors[target][selector], "Function not whitelisted");

        // SECURITY: Verify the caller is authorized by this user via EIP-8004
        IEIP8004Agent.AgentAuthorization memory auth = cultiv8Agent.getAuthorization(user);
        require(auth.active, "User has not authorized agent");
        require(auth.agent == msg.sender, "Caller not authorized for this user");

        // SECURITY: Verify amount is within user's limits (pre-check before recording)
        require(cultiv8Agent.canExecute(user, amount), "Amount exceeds user limits");

        // SECURITY: Verify user has sufficient balance in this vault
        require(balances[user] >= amount, "Insufficient user balance");

        // Execute the delegated call
        (bool success, bytes memory returnData) = target.call(data);
        require(success, "Delegated call failed");

        // SECURITY: Decrement user balance to prevent double-spending
        // This ensures internal accounting matches actual fund availability
        balances[user] -= amount;

        // SECURITY: Record spending in Cultiv8Agent to enforce daily limits
        // This MUST happen after successful execution to prevent limit bypass
        // Pass msg.sender as executingAgent for defense-in-depth validation
        bytes32 strategyHash = keccak256(data);
        cultiv8Agent.recordSpending(user, target, amount, strategyHash, msg.sender);

        emit Delegated(user, target, data);
        return returnData;
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
     * @notice Batch whitelist multiple protocols
     * @param protocols Array of protocol addresses
     * @param statuses Array of whitelist statuses
     */
    function batchSetProtocolWhitelist(
        address[] calldata protocols,
        bool[] calldata statuses
    ) external onlyOwner {
        require(protocols.length == statuses.length, "Length mismatch");
        for (uint256 i = 0; i < protocols.length; i++) {
            require(protocols[i] != address(0), "Invalid protocol address");
            whitelistedProtocols[protocols[i]] = statuses[i];
            emit ProtocolWhitelisted(protocols[i], statuses[i]);
        }
    }

    /**
     * @notice Whitelist a function selector for a protocol
     * @dev Only whitelisted selectors can be called via executeDelegated
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
     * @notice Emergency pause mechanism
     * @param _paused true to pause, false to unpause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPaused(_paused);
    }
    
    /**
     * @notice Get user balance
     * @param user User address
     * @return User's USDC balance in vault
     */
    function balanceOf(address user) external view returns (uint256) {
        return balances[user];
    }
    
    /**
     * @notice Get total vault TVL
     * @return Total USDC deposited
     */
    function totalValueLocked() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}

