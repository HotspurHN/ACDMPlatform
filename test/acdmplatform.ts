import { expect } from "chai";
import { Erc20my } from "../typechain-types/Erc20my";
import { ACDMPlatform } from "../typechain-types/ACDMPlatform";
const { ethers } = require("hardhat");

describe("ACDMPlatform", function () {

    const tokenName: string = "Erc20my";
    const tokenSymbol: string = "EMY";
    const tokenDecimals: number = 18;
    const tokenTotalSupply: number = 1000000;

    const roundDuration = 1000;

    let owner: any;
    let addr1: any;
    let addr2: any;
    let addr3: any;

    let Erc20my: any;
    let Erc20myInstance: Erc20my;
    let ACDMTokenInstance: Erc20my;
    let ACDMPlatform: any;
    let ACDMPlatformInstance: ACDMPlatform;

    before(async () => {
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        Erc20my = await ethers.getContractFactory("Erc20my");
        ACDMPlatform = await ethers.getContractFactory("ACDMPlatform");
    });

    beforeEach(async () => {
        Erc20myInstance = await Erc20my.deploy(tokenName, tokenSymbol, tokenDecimals, tokenTotalSupply);
        await Erc20myInstance.deployed();
        ACDMTokenInstance = await Erc20my.deploy('ACADEM Coin', 'ACDM', 6, 0);
        await ACDMTokenInstance.deployed();

        ACDMPlatformInstance = await ACDMPlatform.deploy(ACDMTokenInstance.address, roundDuration);
        await ACDMPlatformInstance.deployed();

        await ACDMTokenInstance.setMinter(ACDMPlatformInstance.address);
        await Erc20myInstance.connect(owner).transfer(addr1.address, 1000);
        await Erc20myInstance.connect(owner).transfer(addr2.address, 1000);
        await Erc20myInstance.connect(owner).transfer(addr3.address, 1000);
    });

    const nextRound = async () => {
        let now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        await ethers.provider.send("evm_mine", [now + roundDuration]);
    };

    describe("register", function () {
        it("should register a new user", async () => {
            await ACDMPlatformInstance.register('0x0000000000000000000000000000000000000000');
            expect(await ACDMPlatformInstance.registeredUsers(owner.address)).to.be.true;
        });

        it("should not possible to register with wrong referrer", async () => {
            await expect(ACDMPlatformInstance.register(addr1.address)).to.be.revertedWith('Referrer not registered');
        });

        it("should register with referrer", async () => {
            await ACDMPlatformInstance.connect(addr1).register('0x0000000000000000000000000000000000000000');
            await ACDMPlatformInstance.register(addr1.address);
            expect(await ACDMPlatformInstance.registeredUsers(owner.address)).to.be.true;
            expect(await ACDMPlatformInstance.referrers(owner.address)).to.be.equal(addr1.address);
        });
    });

    describe("startSaleRound", function () {
        it("should start a new sale round", async () => {
            await nextRound();
            await ACDMPlatformInstance.startTradeRound();
            await nextRound();
            await ACDMPlatformInstance.startSaleRound();
            expect(await ACDMPlatformInstance.isSaleRound()).to.be.true;
            expect(await ACDMPlatformInstance.acdmTokenPool()).to.be.equal(await ACDMPlatformInstance.baseAcdmTokenPool());
        });
        it("should update trade rate on new round start", async () => {
            const startRate = await ACDMPlatformInstance.tradeRate();
            await nextRound();
            await ACDMPlatformInstance.startTradeRound();
            await nextRound();
            await ACDMPlatformInstance.startSaleRound();
            expect(await ACDMPlatformInstance.isSaleRound()).to.be.true;
            expect(await ACDMPlatformInstance.tradeRate()).to.be.equal(startRate.toNumber() * 1.03 + 40000);
        });
        it("should not possible to start a new sales round if it already started", async () => {
            await expect(ACDMPlatformInstance.startSaleRound()).to.be.revertedWith('Could be call only in trade round');
        });
    });

    describe("startTradeRound", function () {
        it("should start a new trade round", async () => {
            await nextRound();
            await ACDMPlatformInstance.startTradeRound();
            expect(await ACDMPlatformInstance.isSaleRound()).to.be.false;
        });
        it("should not possible to start a new trade round if it already started", async () => {
            await nextRound();
            await ACDMPlatformInstance.startTradeRound();
            await expect(ACDMPlatformInstance.startTradeRound()).to.be.revertedWith('Could be call only in sale round');
        });
    });

    describe("buyACDMToken", function () {
        it("should buy ACADEM tokens", async () => {
            await ACDMPlatformInstance.connect(addr1).register('0x0000000000000000000000000000000000000000');
            await ACDMPlatformInstance.connect(addr1).buyACDMToken({
                value: ethers.utils.parseEther("0.1")
            });
            expect(await ACDMTokenInstance.balanceOf(addr1.address)).to.be.equals(10000 * Math.pow(10, await ACDMTokenInstance.decimals()));
            expect(await ACDMPlatformInstance.acdmTokenPool()).to.be.equals(90000 * Math.pow(10, await ACDMTokenInstance.decimals()));
        });
        it("should recieve tax for referrals", async () => {
            await ACDMPlatformInstance.connect(addr2).register('0x0000000000000000000000000000000000000000');
            await ACDMPlatformInstance.connect(addr1).register(addr2.address);
            await ACDMPlatformInstance.register(addr1.address);

            const balance1before = await ethers.provider.getBalance(addr2.address);
            const balance2before = await ethers.provider.getBalance(addr1.address);
            const balancePlatformBefore = await ethers.provider.getBalance(ACDMPlatformInstance.address);

            await ACDMPlatformInstance.buyACDMToken({
                value: ethers.utils.parseEther("0.1")
            });
            const balance1 = await ethers.provider.getBalance(addr2.address);
            const balance2 = await ethers.provider.getBalance(addr1.address);
            const balancePlatform = await ethers.provider.getBalance(ACDMPlatformInstance.address);

            expect(await ACDMTokenInstance.balanceOf(owner.address)).to.be.equals(10000 * Math.pow(10, await ACDMTokenInstance.decimals()));
            expect(await ACDMPlatformInstance.acdmTokenPool()).to.be.equals(90000 * Math.pow(10, await ACDMTokenInstance.decimals()));
            expect(balance1.sub(balance1before)).to.be.equals(ethers.utils.parseEther("0.1").mul(await ACDMPlatformInstance.ref2Tax()).div(1000));
            expect(balance2.sub(balance2before)).to.be.equals(ethers.utils.parseEther("0.1").mul(await ACDMPlatformInstance.ref1Tax()).div(1000));
            expect(balancePlatform.sub(balancePlatformBefore)).to.be.equals(ethers.utils.parseEther("0.1").mul(92).div(100));
        });
        it ("should buy academ tokens in 2nd round bonus", async () => {
            await ACDMPlatformInstance.connect(addr1).register('0x0000000000000000000000000000000000000000');
            await nextRound();
            await ACDMPlatformInstance.startTradeRound();
            await nextRound();
            await ACDMPlatformInstance.startSaleRound();
            await ACDMPlatformInstance.connect(addr1).buyACDMToken({
                value: ethers.utils.parseEther("0.1")
            });
            const newRate = Math.round(1000000 * Math.pow(10, await ACDMTokenInstance.decimals()) / 143);
            expect(await ACDMTokenInstance.balanceOf(addr1.address)).to.be.equals(newRate);
            expect(await ACDMPlatformInstance.acdmTokenPool()).to.be
                .equals(ethers.BigNumber.from('100000000000').sub(newRate));
        });
    });

    describe("addOrder", function () {
        it("should add an order", async () => {
            await ACDMPlatformInstance.register('0x0000000000000000000000000000000000000000');
            await ACDMTokenInstance.setMinter(owner.address);
            await ACDMTokenInstance.mint(owner.address, 10000);
            await ACDMTokenInstance.setMinter(ACDMPlatformInstance.address);
            await ACDMTokenInstance.approve(ACDMPlatformInstance.address, 10000);
            await nextRound();

            await ACDMPlatformInstance.startTradeRound();
            const orderId = await ACDMPlatformInstance.addOrder(1000, '1000000000000000000');
            const order = await ACDMPlatformInstance.orders(orderId.value);
            expect(await ACDMTokenInstance.balanceOf(owner.address)).to.be.equals(9000);
            expect(await ACDMTokenInstance.balanceOf(ACDMPlatformInstance.address)).to.be.equals(1000);
            expect(order.price).to.be.equals(ethers.utils.parseEther("1").div(1000));
        });
    });

    describe("removeOrder", function () {
        it("should remove an order", async () => {
            await ACDMPlatformInstance.register('0x0000000000000000000000000000000000000000');
            await ACDMTokenInstance.setMinter(owner.address);
            await ACDMTokenInstance.mint(owner.address, 10000);
            await ACDMTokenInstance.setMinter(ACDMPlatformInstance.address);
            await ACDMTokenInstance.approve(ACDMPlatformInstance.address, 10000);
            await nextRound();

            await ACDMPlatformInstance.startTradeRound();
            await ACDMPlatformInstance.addOrder(1000, 1);
            await ACDMPlatformInstance.removeOrder(0);

            expect(await ACDMTokenInstance.balanceOf(owner.address)).to.be.equals(10000);
        });
    });

    describe("redeemOrder", function () {
        it("should redeem an order", async () => {
            await ACDMPlatformInstance.register('0x0000000000000000000000000000000000000000');
            await ACDMPlatformInstance.connect(addr1).register('0x0000000000000000000000000000000000000000');
            await ACDMTokenInstance.setMinter(owner.address);
            await ACDMTokenInstance.mint(owner.address, 10000);
            await ACDMTokenInstance.mint(addr1.address, 10000);
            await ACDMTokenInstance.setMinter(ACDMPlatformInstance.address);
            await ACDMTokenInstance.approve(ACDMPlatformInstance.address, 10000);
            await ACDMTokenInstance.connect(addr1).approve(ACDMPlatformInstance.address, 10000);
            await nextRound();

            await ACDMPlatformInstance.startTradeRound();
            const orderId = await ACDMPlatformInstance.addOrder(1000, ethers.utils.parseEther("1"));
            const balance = await ethers.provider.getBalance(owner.address);
            await ACDMPlatformInstance.connect(addr1).redeemOrder(orderId.value, {
                value: ethers.utils.parseEther("0.1")
            });
            const balanceAfter = await ethers.provider.getBalance(owner.address);
            const order = await ACDMPlatformInstance.orders(orderId.value);
            expect(await ACDMTokenInstance.balanceOf(owner.address)).to.be.equals(9000);
            expect(await ACDMTokenInstance.balanceOf(ACDMPlatformInstance.address)).to.be.equals(905);
            expect(await ACDMTokenInstance.balanceOf(addr1.address)).to.be.equals(10095);
            expect(balance.add(ethers.utils.parseEther("0.1"))).to.be.equals(balanceAfter);
            expect(order.price).to.be.equals(ethers.utils.parseEther("1").div(1000));
            expect(order.amount).to.be.equals(900);
        });
        it("should redeem an order with referrals", async () => {
            await ACDMPlatformInstance.connect(addr2).register('0x0000000000000000000000000000000000000000');
            await ACDMPlatformInstance.connect(addr1).register(addr2.address);
            await ACDMPlatformInstance.register(addr1.address);

            await ACDMTokenInstance.setMinter(owner.address);
            await ACDMTokenInstance.mint(owner.address, 10000);
            await ACDMTokenInstance.mint(addr1.address, 10000);
            await ACDMTokenInstance.setMinter(ACDMPlatformInstance.address);
            await ACDMTokenInstance.approve(ACDMPlatformInstance.address, 10000);
            await ACDMTokenInstance.connect(addr1).approve(ACDMPlatformInstance.address, 10000);
            await nextRound();

            await ACDMPlatformInstance.startTradeRound();
            const orderId = await ACDMPlatformInstance.addOrder(1000, ethers.utils.parseEther("0.1"));

            const balance1before = await ACDMTokenInstance.balanceOf(addr2.address);
            const balance2before = await ACDMTokenInstance.balanceOf(addr1.address);

            await ACDMPlatformInstance.redeemOrder(orderId.value, {
                value: ethers.utils.parseEther("0.1")
            });

            const balance1 = await ACDMTokenInstance.balanceOf(addr2.address);
            const balance2 = await ACDMTokenInstance.balanceOf(addr1.address);

            expect(await ACDMTokenInstance.balanceOf(ACDMPlatformInstance.address)).to.be.equals(0);
            expect(await ACDMTokenInstance.balanceOf(owner.address)).to.be.equals(9950);
            expect(balance1.sub(balance1before)).to.be.equals(25);
            expect(balance2.sub(balance2before)).to.be.equals(25);
        });
    });
});