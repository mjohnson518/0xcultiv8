// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IEIP7702Vault.sol";

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
    
    /// @notice Authorized Cultiv8 agent address
    address public immutable cultiv8Agent;
    
    /// @notice User balances
    mapping(address => uint256) public balances;
    
    /// @notice Emergency pause state
    bool public paused;
    
    /// @notice Minimum deposit amount
    uint256 public constant MIN_DEPOSIT = 10 * 1e6; // $10 USDC
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    constructor(address _usdc, address _cultiv8Agent) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_cultiv8Agent != address(0), "Invalid agent address");
        usdc = IERC20(_usdc);
        cultiv8Agent = _cultiv8Agent;
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
     * @param target Target contract to call
     * @param data Calldata to execute
     * @return result Return data from call
     */
    function executeDelegated(
        address target,
        bytes calldata data
    ) external nonReentrant whenNotPaused returns (bytes memory result) {
        require(msg.sender == cultiv8Agent, "Only agent can delegate");
        require(target != address(0), "Invalid target");
        
        (bool success, bytes memory returnData) = target.call(data);
        require(success, "Delegated call failed");
        
        emit Delegated(msg.sender, target, data);
        return returnData;
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

