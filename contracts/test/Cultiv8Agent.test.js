const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("Cultiv8Agent - EIP-8004 Compliance", function () {
  let agent, owner, user, unauthorizedAgent, protocol;
  let agentAddress;

  const USDC_DECIMALS = 6;
  const toUSDC = (amount) => ethers.parseUnits(amount.toString(), USDC_DECIMALS);

  // Valid 4-byte function selectors for testing
  // Using realistic DeFi function selectors
  const TEST_SELECTOR_1 = "0xa9059cbb"; // transfer(address,uint256)
  const TEST_SELECTOR_2 = "0x23b872dd"; // transferFrom(address,address,uint256)
  const TEST_SELECTOR_3 = "0x095ea7b3"; // approve(address,uint256)
  const TEST_SELECTOR_4 = "0x70a08231"; // balanceOf(address)
  const TEST_SELECTOR_5 = "0xdd62ed3e"; // allowance(address,address)
  const TEST_SELECTOR_6 = "0x18160ddd"; // totalSupply()

  // Create valid calldata with 4-byte selector + padding
  const makeCalldata = (selector) => selector + "0".repeat(56); // 4 bytes + 28 bytes padding = 32 bytes

  beforeEach(async function () {
    [owner, user, unauthorizedAgent, protocol] = await ethers.getSigners();

    const Agent = await ethers.getContractFactory("Cultiv8Agent");
    agent = await Agent.deploy();
    await agent.waitForDeployment();

    agentAddress = await agent.getAddress();

    // Whitelist test protocol
    await agent.setProtocolWhitelist(protocol.address, true);

    // Whitelist test selectors for the protocol
    await agent.setSelectorWhitelist(protocol.address, TEST_SELECTOR_1, true);
    await agent.setSelectorWhitelist(protocol.address, TEST_SELECTOR_2, true);
    await agent.setSelectorWhitelist(protocol.address, TEST_SELECTOR_3, true);
    await agent.setSelectorWhitelist(protocol.address, TEST_SELECTOR_4, true);
    await agent.setSelectorWhitelist(protocol.address, TEST_SELECTOR_5, true);
    await agent.setSelectorWhitelist(protocol.address, TEST_SELECTOR_6, true);
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
      const strategyData = makeCalldata(TEST_SELECTOR_1); // Valid calldata with whitelisted selector
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
          makeCalldata(TEST_SELECTOR_1),
          toUSDC(500)
        )
      ).to.be.revertedWith("Unauthorized agent");
    });

    it("Should enforce per-transaction limits", async function () {
      await expect(
        agent.connect(owner).executeStrategy(
          user.address,
          protocol.address,
          makeCalldata(TEST_SELECTOR_1),
          toUSDC(2000) // Exceeds maxAmountPerTx of $1000
        )
      ).to.be.revertedWith("Exceeds per-transaction limit");
    });

    it("Should enforce daily limits", async function () {
      // Execute transactions totaling $4800 (within $5000 daily limit)
      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        makeCalldata(TEST_SELECTOR_1),
        toUSDC(1000)
      );

      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        makeCalldata(TEST_SELECTOR_2),
        toUSDC(1000)
      );

      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        makeCalldata(TEST_SELECTOR_3),
        toUSDC(1000)
      );

      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        makeCalldata(TEST_SELECTOR_4),
        toUSDC(800)
      );

      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        makeCalldata(TEST_SELECTOR_5),
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
          makeCalldata(TEST_SELECTOR_6),
          toUSDC(500)
        )
      ).to.be.revertedWith("Exceeds daily limit");
    });

    it("Should reset daily limit after 24 hours", async function () {
      // Execute transaction
      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        makeCalldata(TEST_SELECTOR_1),
        toUSDC(1000)
      );

      let auth = await agent.getAuthorization(user.address);
      expect(auth.dailySpent).to.equal(toUSDC(1000));

      // Mine 7200+ blocks to advance to next "day" (BLOCKS_PER_DAY = 7200)
      await mine(7201);

      // Execute another transaction - should reset daily spent
      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        makeCalldata(TEST_SELECTOR_2),
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
          makeCalldata(TEST_SELECTOR_1),
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
          makeCalldata(TEST_SELECTOR_1),
          toUSDC(500)
        )
      ).to.be.revertedWith("Contract is paused");
    });

    it("Should reject non-whitelisted selector", async function () {
      const nonWhitelistedSelector = "0x12345678"; // Not whitelisted
      await expect(
        agent.connect(owner).executeStrategy(
          user.address,
          protocol.address,
          makeCalldata(nonWhitelistedSelector),
          toUSDC(500)
        )
      ).to.be.revertedWith("Function not whitelisted");
    });

    it("Should increment execution counter", async function () {
      const initialCount = await agent.getExecutionHistoryLength();

      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        makeCalldata(TEST_SELECTOR_1),
        toUSDC(500)
      );

      const newCount = await agent.getExecutionHistoryLength();
      expect(newCount).to.equal(initialCount + 1n);

      // Execute another
      await agent.connect(owner).executeStrategy(
        user.address,
        protocol.address,
        makeCalldata(TEST_SELECTOR_2),
        toUSDC(300)
      );

      const finalCount = await agent.getExecutionHistoryLength();
      expect(finalCount).to.equal(initialCount + 2n);
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
          makeCalldata(TEST_SELECTOR_1),
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
        makeCalldata(TEST_SELECTOR_1),
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
        makeCalldata(TEST_SELECTOR_1),
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

