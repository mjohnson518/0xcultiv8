const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Cultiv8Agent - EIP-8004 Compliance", function () {
  let agent, owner, user, unauthorizedAgent, protocol;
  let agentAddress;

  const USDC_DECIMALS = 6;
  const toUSDC = (amount) => ethers.parseUnits(amount.toString(), USDC_DECIMALS);

  beforeEach(async function () {
    [owner, user, unauthorizedAgent, protocol] = await ethers.getSigners();

    const Agent = await ethers.getContractFactory("Cultiv8Agent");
    agent = await Agent.deploy();
    await agent.waitForDeployment();

    agentAddress = await agent.getAddress();

    // Whitelist test protocol
    await agent.setProtocolWhitelist(protocol.address, true);
  });

  describe("Authorization", function () {
    it("Should allow user to authorize agent", async function () {
      await agent.connect(user).authorizeAgent(
        owner.address,
        toUSDC(1000), // $1000 per tx
        toUSDC(5000)  // $5000 daily
      );

      const auth = await agent.getAuthorization(user.address);
      expect(auth.active).to.be.true;
      expect(auth.agent).to.equal(owner.address);
      expect(auth.maxAmountPerTx).to.equal(toUSDC(1000));
      expect(auth.dailyLimit).to.equal(toUSDC(5000));
      expect(auth.dailySpent).to.equal(0);
    });

    it("Should emit AgentAuthorized event", async function () {
      await expect(
        agent.connect(user).authorizeAgent(
          owner.address,
          toUSDC(1000),
          toUSDC(5000)
        )
      )
        .to.emit(agent, "AgentAuthorized")
        .withArgs(user.address, owner.address, toUSDC(1000), toUSDC(5000));
    });

    it("Should reject authorization with zero agent address", async function () {
      await expect(
        agent.connect(user).authorizeAgent(
          ethers.ZeroAddress,
          toUSDC(1000),
          toUSDC(5000)
        )
      ).to.be.revertedWith("Invalid agent address");
    });

    it("Should reject authorization below minimum", async function () {
      await expect(
        agent.connect(user).authorizeAgent(
          owner.address,
          toUSDC(50), // Below MIN_AUTHORIZATION ($100)
          toUSDC(5000)
        )
      ).to.be.revertedWith("Amount too small");
    });

    it("Should reject daily limit < per-tx limit", async function () {
      await expect(
        agent.connect(user).authorizeAgent(
          owner.address,
          toUSDC(5000),
          toUSDC(1000) // Daily less than per-tx
        )
      ).to.be.revertedWith("Daily limit must >= per-tx limit");
    });

    it("Should reject authorization when paused", async function () {
      await agent.setPaused(true);

      await expect(
        agent.connect(user).authorizeAgent(
          owner.address,
          toUSDC(1000),
          toUSDC(5000)
        )
      ).to.be.revertedWith("Contract is paused");
    });
  });

  describe("Execution", function () {
    beforeEach(async function () {
      // Authorize agent
      await agent.connect(user).authorizeAgent(
        owner.address,
        toUSDC(1000),
        toUSDC(5000)
      );
    });

    it("Should allow authorized agent to execute strategy", async function () {
      const strategyData = "0x1234"; // Mock strategy calldata
      const amount = toUSDC(500);

      await expect(
        agent.connect(owner).executeStrategy(
          user.address,
          protocol.address,
          strategyData,
          amount
        )
      ).to.not.be.reverted;

      // Check daily spent updated
      const auth = await agent.getAuthorization(user.address);
      expect(auth.dailySpent).to.equal(amount);
    });

    it("Should reject unauthorized agent", async function () {
      await expect(
        agent.connect(unauthorizedAgent).executeStrategy(
          user.address,
          protocol.address,
          "0x1234",
          toUSDC(500)
        )
      ).to.be.revertedWith("Unauthorized agent");
    });

    it("Should enforce per-transaction limits", async function () {
      await expect(
        agent.connect(owner).executeStrategy(
          user.address,
          protocol.address,
          "0x1234",
          toUSDC(2000) // Exceeds maxAmountPerTx of $1000
        )
      ).to.be.revertedWith("Exceeds per-transaction limit");
    });

    it("Should enforce daily limits", async function () {
      // Execute transactions totaling $4800 (within $5000 daily limit)
      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        "0x1234",
        toUSDC(1000)
      );

      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        "0x5678",
        toUSDC(1000)
      );

      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        "0x9abc",
        toUSDC(1000)
      );

      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        "0xabcd",
        toUSDC(800)
      );

      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        "0xbcde",
        toUSDC(1000)
      );

      // Verify total spent is $4800
      let auth = await agent.getAuthorization(user.address);
      expect(auth.dailySpent).to.equal(toUSDC(4800));

      // Next transaction of $500 would bring total to $5300, exceeding $5000 daily limit
      await expect(
        agent.connect(owner).executeStrategy(
          user.address,
          protocol.address,
          "0xdef0",
          toUSDC(500)
        )
      ).to.be.revertedWith("Exceeds daily limit");
    });

    it("Should reset daily limit after 24 hours", async function () {
      // Execute transaction
      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        "0x1234",
        toUSDC(1000)
      );

      let auth = await agent.getAuthorization(user.address);
      expect(auth.dailySpent).to.equal(toUSDC(1000));

      // Fast forward 24 hours
      await time.increase(24 * 60 * 60);

      // Execute another transaction - should reset daily spent
      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        "0x5678",
        toUSDC(1000)
      );

      auth = await agent.getAuthorization(user.address);
      expect(auth.dailySpent).to.equal(toUSDC(1000)); // Reset, only shows latest
    });

    it("Should reject non-whitelisted protocol", async function () {
      const nonWhitelisted = unauthorizedAgent.address;

      await expect(
        agent.connect(owner).executeStrategy(
          user.address,
          nonWhitelisted,
          "0x1234",
          toUSDC(500)
        )
      ).to.be.revertedWith("Protocol not whitelisted");
    });

    it("Should reject execution when paused", async function () {
      await agent.setPaused(true);

      await expect(
        agent.connect(owner).executeStrategy(
          user.address,
          protocol.address,
          "0x1234",
          toUSDC(500)
        )
      ).to.be.revertedWith("Contract is paused");
    });

    it("Should record execution history", async function () {
      const initialLength = await agent.getExecutionHistoryLength();

      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        "0x1234",
        toUSDC(500)
      );

      const newLength = await agent.getExecutionHistoryLength();
      expect(newLength).to.equal(initialLength + 1n);

      const record = await agent.executionHistory(initialLength);
      expect(record.user).to.equal(user.address);
      expect(record.protocol).to.equal(protocol.address);
      expect(record.amount).to.equal(toUSDC(500));
      expect(record.success).to.be.true;
    });
  });

  describe("Revocation", function () {
    beforeEach(async function () {
      await agent.connect(user).authorizeAgent(
        owner.address,
        toUSDC(1000),
        toUSDC(5000)
      );
    });

    it("Should allow user to revoke authorization", async function () {
      await agent.connect(user).revokeAgent();

      const auth = await agent.getAuthorization(user.address);
      expect(auth.active).to.be.false;
    });

    it("Should emit AgentRevoked event", async function () {
      await expect(agent.connect(user).revokeAgent())
        .to.emit(agent, "AgentRevoked")
        .withArgs(user.address, owner.address);
    });

    it("Should prevent execution after revocation", async function () {
      await agent.connect(user).revokeAgent();

      await expect(
        agent.connect(owner).executeStrategy(
          user.address,
          protocol.address,
          "0x1234",
          toUSDC(500)
        )
      ).to.be.revertedWith("Agent not authorized");
    });
  });

  describe("Limit Updates", function () {
    beforeEach(async function () {
      await agent.connect(user).authorizeAgent(
        owner.address,
        toUSDC(1000),
        toUSDC(5000)
      );
    });

    it("Should allow updating limits", async function () {
      await agent.connect(user).updateLimits(
        toUSDC(2000),
        toUSDC(10000)
      );

      const auth = await agent.getAuthorization(user.address);
      expect(auth.maxAmountPerTx).to.equal(toUSDC(2000));
      expect(auth.dailyLimit).to.equal(toUSDC(10000));
    });

    it("Should maintain daily spent when updating", async function () {
      // Execute transaction
      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        "0x1234",
        toUSDC(500)
      );

      // Update limits
      await agent.connect(user).updateLimits(
        toUSDC(2000),
        toUSDC(10000)
      );

      const auth = await agent.getAuthorization(user.address);
      expect(auth.dailySpent).to.equal(toUSDC(500)); // Preserved
    });

    it("Should reject invalid limit updates", async function () {
      await expect(
        agent.connect(user).updateLimits(
          toUSDC(10000),
          toUSDC(5000) // Daily < per-tx
        )
      ).to.be.revertedWith("Daily limit must >= per-tx limit");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to whitelist protocol", async function () {
      const newProtocol = unauthorizedAgent.address;

      await agent.setProtocolWhitelist(newProtocol, true);

      expect(await agent.whitelistedProtocols(newProtocol)).to.be.true;
    });

    it("Should allow owner to remove protocol from whitelist", async function () {
      await agent.setProtocolWhitelist(protocol.address, false);

      expect(await agent.whitelistedProtocols(protocol.address)).to.be.false;
    });

    it("Should emit ProtocolWhitelisted event", async function () {
      const newProtocol = unauthorizedAgent.address;

      await expect(agent.setProtocolWhitelist(newProtocol, true))
        .to.emit(agent, "ProtocolWhitelisted")
        .withArgs(newProtocol, true);
    });

    it("Should reject non-owner whitelist attempts", async function () {
      await expect(
        agent.connect(user).setProtocolWhitelist(protocol.address, true)
      ).to.be.revertedWithCustomError(agent, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to pause/unpause", async function () {
      await agent.setPaused(true);
      expect(await agent.paused()).to.be.true;

      await agent.setPaused(false);
      expect(await agent.paused()).to.be.false;
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await agent.connect(user).authorizeAgent(
        owner.address,
        toUSDC(1000),
        toUSDC(5000)
      );
    });

    it("Should correctly report canExecute", async function () {
      // Can execute within limit
      expect(await agent.canExecute(user.address, toUSDC(500))).to.be.true;

      // Cannot execute over per-tx limit
      expect(await agent.canExecute(user.address, toUSDC(2000))).to.be.false;
    });

    it("Should correctly report remaining daily limit", async function () {
      let remaining = await agent.getRemainingDailyLimit(user.address);
      expect(remaining).to.equal(toUSDC(5000));

      // Execute transaction within per-tx limit
      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        "0x1234",
        toUSDC(800) // Within $1000 per-tx limit
      );

      remaining = await agent.getRemainingDailyLimit(user.address);
      expect(remaining).to.equal(toUSDC(4200));
    });

    it("Should return zero remaining for unauthorized user", async function () {
      const remaining = await agent.getRemainingDailyLimit(unauthorizedAgent.address);
      expect(remaining).to.equal(0);
    });
  });
});

