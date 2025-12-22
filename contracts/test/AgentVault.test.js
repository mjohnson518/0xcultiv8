const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentVault - EIP-7702 Compatible", function () {
  let vault, usdc, cultiv8Agent, owner, agent, user, mockProtocol;
  let vaultAddress, cultiv8AgentAddress, mockProtocolAddress;

  const USDC_DECIMALS = 6;
  const toUSDC = (amount) => ethers.parseUnits(amount.toString(), USDC_DECIMALS);

  beforeEach(async function () {
    [owner, agent, user, mockProtocol] = await ethers.getSigners();

    // Deploy mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // Deploy Cultiv8Agent first
    const Cultiv8Agent = await ethers.getContractFactory("Cultiv8Agent");
    cultiv8Agent = await Cultiv8Agent.deploy();
    await cultiv8Agent.waitForDeployment();
    cultiv8AgentAddress = await cultiv8Agent.getAddress();

    // Deploy vault with Cultiv8Agent reference
    const Vault = await ethers.getContractFactory("AgentVault");
    vault = await Vault.deploy(await usdc.getAddress(), cultiv8AgentAddress);
    await vault.waitForDeployment();
    vaultAddress = await vault.getAddress();

    // Set vault as authorized in Cultiv8Agent
    await cultiv8Agent.setAuthorizedVault(vaultAddress);

    mockProtocolAddress = mockProtocol.address;

    // Mint USDC to user
    await usdc.mint(user.address, toUSDC(10000));
  });

  describe("Deposits", function () {
    it("Should allow user to deposit USDC", async function () {
      const amount = toUSDC(1000);

      // Approve vault
      await usdc.connect(user).approve(vaultAddress, amount);

      // Deposit
      await expect(vault.connect(user).deposit(amount))
        .to.emit(vault, "Deposited")
        .withArgs(user.address, amount);

      expect(await vault.balanceOf(user.address)).to.equal(amount);
      expect(await usdc.balanceOf(vaultAddress)).to.equal(amount);
    });

    it("Should reject deposits below minimum", async function () {
      const amount = toUSDC(5); // Below MIN_DEPOSIT ($10)

      await usdc.connect(user).approve(vaultAddress, amount);

      await expect(vault.connect(user).deposit(amount))
        .to.be.revertedWith("Amount below minimum");
    });

    it("Should reject deposits when paused", async function () {
      await vault.setPaused(true);

      const amount = toUSDC(1000);
      await usdc.connect(user).approve(vaultAddress, amount);

      await expect(vault.connect(user).deposit(amount))
        .to.be.revertedWith("Contract is paused");
    });

    it("Should handle multiple deposits", async function () {
      await usdc.connect(user).approve(vaultAddress, toUSDC(5000));

      await vault.connect(user).deposit(toUSDC(1000));
      await vault.connect(user).deposit(toUSDC(500));
      await vault.connect(user).deposit(toUSDC(2000));

      expect(await vault.balanceOf(user.address)).to.equal(toUSDC(3500));
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      const amount = toUSDC(5000);
      await usdc.connect(user).approve(vaultAddress, amount);
      await vault.connect(user).deposit(amount);
    });

    it("Should allow user to withdraw USDC", async function () {
      const amount = toUSDC(1000);
      const initialBalance = await usdc.balanceOf(user.address);

      await expect(vault.connect(user).withdraw(amount))
        .to.emit(vault, "Withdrawn")
        .withArgs(user.address, amount);

      expect(await vault.balanceOf(user.address)).to.equal(toUSDC(4000));
      expect(await usdc.balanceOf(user.address)).to.equal(initialBalance + amount);
    });

    it("Should reject withdrawal exceeding balance", async function () {
      await expect(
        vault.connect(user).withdraw(toUSDC(10000))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should allow withdrawal even when paused", async function () {
      await vault.setPaused(true);

      // Withdrawals should still work during emergency
      await expect(vault.connect(user).withdraw(toUSDC(1000)))
        .to.not.be.reverted;
    });
  });

  describe("Delegated Execution", function () {
    const mockSelector = "0x12345678";
    const mockCalldata = mockSelector + "0".repeat(56); // 4 byte selector + padding

    beforeEach(async function () {
      // Setup: User deposits funds
      await usdc.connect(user).approve(vaultAddress, toUSDC(5000));
      await vault.connect(user).deposit(toUSDC(5000));

      // Setup: User authorizes agent via Cultiv8Agent
      await cultiv8Agent.connect(user).authorizeAgent(
        agent.address,
        toUSDC(1000),  // maxAmountPerTx
        toUSDC(5000)   // dailyLimit
      );

      // Setup: Whitelist mock protocol in both contracts
      await cultiv8Agent.setProtocolWhitelist(mockProtocolAddress, true);
      await vault.setProtocolWhitelist(mockProtocolAddress, true);
      await vault.setSelectorWhitelist(mockProtocolAddress, mockSelector, true);
    });

    it("Should allow agent to execute delegated calls", async function () {
      const amount = toUSDC(100);

      await expect(
        vault.connect(agent).executeDelegated(user.address, mockProtocolAddress, amount, mockCalldata)
      ).to.emit(vault, "Delegated")
        .withArgs(user.address, mockProtocolAddress, mockCalldata);
    });

    it("Should reject delegated calls from non-agent", async function () {
      const amount = toUSDC(100);

      await expect(
        vault.connect(user).executeDelegated(user.address, mockProtocolAddress, amount, mockCalldata)
      ).to.be.revertedWith("Caller not authorized for this user");
    });

    it("Should reject delegated calls when paused", async function () {
      await vault.setPaused(true);
      const amount = toUSDC(100);

      await expect(
        vault.connect(agent).executeDelegated(user.address, mockProtocolAddress, amount, mockCalldata)
      ).to.be.revertedWith("Contract is paused");
    });

    it("Should reject calls to non-whitelisted protocol", async function () {
      const amount = toUSDC(100);

      await expect(
        vault.connect(agent).executeDelegated(user.address, user.address, amount, mockCalldata)
      ).to.be.revertedWith("Protocol not whitelisted");
    });

    it("Should reject calls with non-whitelisted selector", async function () {
      const amount = toUSDC(100);
      const badCalldata = "0xdeadbeef" + "0".repeat(56);

      await expect(
        vault.connect(agent).executeDelegated(user.address, mockProtocolAddress, amount, badCalldata)
      ).to.be.revertedWith("Function not whitelisted");
    });

    it("Should reject if user has insufficient balance", async function () {
      // First withdraw most funds to create insufficient balance scenario
      await vault.connect(user).withdraw(toUSDC(4500));

      // Try to execute with an amount within per-tx limit but exceeds remaining balance
      const amount = toUSDC(1000); // Within per-tx limit, but user only has 500 left

      await expect(
        vault.connect(agent).executeDelegated(user.address, mockProtocolAddress, amount, mockCalldata)
      ).to.be.revertedWith("Insufficient user balance");
    });

    it("Should record spending in Cultiv8Agent", async function () {
      const amount = toUSDC(100);

      await vault.connect(agent).executeDelegated(user.address, mockProtocolAddress, amount, mockCalldata);

      // Verify daily spent was updated
      const auth = await cultiv8Agent.getAuthorization(user.address);
      expect(auth.dailySpent).to.equal(amount);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to pause", async function () {
      await vault.setPaused(true);
      expect(await vault.paused()).to.be.true;
    });

    it("Should emit EmergencyPaused event", async function () {
      await expect(vault.setPaused(true))
        .to.emit(vault, "EmergencyPaused")
        .withArgs(true);
    });

    it("Should reject non-owner pause attempts", async function () {
      await expect(
        vault.connect(user).setPaused(true)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await usdc.connect(user).approve(vaultAddress, toUSDC(5000));
      await vault.connect(user).deposit(toUSDC(5000));
    });

    it("Should correctly report user balance", async function () {
      expect(await vault.balanceOf(user.address)).to.equal(toUSDC(5000));
    });

    it("Should correctly report total value locked", async function () {
      expect(await vault.totalValueLocked()).to.equal(toUSDC(5000));
    });
  });
});

