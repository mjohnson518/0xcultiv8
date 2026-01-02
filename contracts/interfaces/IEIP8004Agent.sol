// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEIP8004Agent
 * @notice Interface for EIP-8004 compliant trustless agent authorization
 * @dev Defines standard for on-chain agent permissions with spending limits
 */
interface IEIP8004Agent {
    struct AgentAuthorization {
        address agent;
        uint256 maxAmountPerTx;
        uint256 dailyLimit;
        uint256 dailySpent;
        uint256 lastResetDay;
        bool active;
        uint256 authorizedAt;
    }

    struct ExecutionRecord {
        address user;
        address protocol;
        uint256 amount;
        bytes32 strategyHash;
        uint256 timestamp;
        bool success;
    }

    event AgentAuthorized(
        address indexed user,
        address indexed agent,
        uint256 maxAmountPerTx,
        uint256 dailyLimit
    );

    event AgentRevoked(address indexed user, address indexed agent);

    event AgentExecuted(
        address indexed user,
        address indexed protocol,
        uint256 amount,
        bytes32 strategyHash,
        bool success
    );

    event ProtocolWhitelisted(address indexed protocol, bool status);

    function authorizeAgent(
        address agent,
        uint256 maxAmountPerTx,
        uint256 dailyLimit
    ) external;

    function executeStrategy(
        address user,
        address protocol,
        bytes calldata strategyData,
        uint256 amount
    ) external returns (bool success);

    function revokeAgent() external;

    function updateLimits(uint256 maxAmountPerTx, uint256 dailyLimit) external;

    function getAuthorization(address user)
        external
        view
        returns (AgentAuthorization memory);

    function canExecute(address user, uint256 amount)
        external
        view
        returns (bool);

    /**
     * @notice Record spending from authorized vault (for EIP-7702 delegated execution)
     * @dev Only callable by the authorized vault contract
     * SECURITY: Includes executingAgent for defense-in-depth validation
     * @param user User whose spending to record
     * @param protocol Target protocol (for event logging)
     * @param amount Amount spent
     * @param strategyHash Hash of the executed strategy data
     * @param executingAgent The agent that initiated the vault call
     */
    function recordSpending(
        address user,
        address protocol,
        uint256 amount,
        bytes32 strategyHash,
        address executingAgent
    ) external;
}

