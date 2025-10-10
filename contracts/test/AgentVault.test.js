const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentVault - EIP-7702 Compatible", function () {
  let vault, usdc, agent, owner, user;
  let vaultAddress;

  const USDC_DECIMALS = 6;
  const toUSDC = (amount) => ethers.parseUnits(amount.toString(), USDC_DECIMALS);

  beforeEach(async function () {
    [owner, agent, user] = await ethers.getSigners();

    // Deploy mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // Deploy vault
    const Vault = await ethers.getContractFactory("AgentVault");
    vault = await Vault.deploy(await usdc.getAddress(), agent.address);
    await vault.waitForDeployment();

    vaultAddress = await vault.getAddress();

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
    it("Should allow agent to execute delegated calls", async function () {
      const target = user.address; // Mock target
      const data = "0x1234";

      await expect(
        vault.connect(agent).executeDelegated(target, data)
      ).to.emit(vault, "Delegated");
    });

    it("Should reject delegated calls from non-agent", async function () {
      await expect(
        vault.connect(user).executeDelegated(user.address, "0x1234")
      ).to.be.revertedWith("Only agent can delegate");
    });

    it("Should reject delegated calls when paused", async function () {
      await vault.setPaused(true);

      await expect(
        vault.connect(agent).executeDelegated(user.address, "0x1234")
      ).to.be.revertedWith("Contract is paused");
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

