// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEIP7702Vault
 * @notice Interface for EIP-7702 compatible vault
 * @dev Supports temporary code delegation for gasless operations
 */
interface IEIP7702Vault {
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Delegated(address indexed user, address indexed target, bytes data);
    event EmergencyPaused(bool status);
    event ProtocolWhitelisted(address indexed protocol, bool status);

    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;

    /**
     * @notice Execute delegated call with per-user authorization
     * @param user User whose funds/authorization are being used
     * @param target Target protocol contract
     * @param amount Amount being transacted (for limit tracking)
     * @param data Calldata to execute
     */
    function executeDelegated(
        address user,
        address target,
        uint256 amount,
        bytes calldata data
    ) external returns (bytes memory);

    function balanceOf(address user) external view returns (uint256);
}

