import { expect } from "chai";
import { StakeEmy } from "../typechain-types/contracts/StakeEmy";
import { Erc20my } from "../typechain-types/contracts/Erc20my";
import { MyDao } from "../typechain-types/contracts/MyDao";
import { IUniswapV2Router02 } from "../typechain-types/contracts/uniswap/IUniswapV2Router02";
import { IERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
const { ethers } = require("hardhat");
import testTools from "./tools";
import tools from "../scripts/tools";
import constants from "../scripts/constants";
import tree from "../scripts/merkletree";
import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";
const buf2hex = (x:any) => '0x'+x.toString('hex')

describe("StakeEmy", function () {
    let owner: any;
    let addr1: any;
    let addr2: any;
    let addr3: any;
    let addr4: any;

    let StakeEmy: any;
    let StakeEmyInstance: StakeEmy;
    let Erc20my: any;
    let Erc20myInstance: Erc20my;
    let MyDao: any;
    let MyDaoInstance: MyDao;
    let Router: IUniswapV2Router02;
    let PairErc20: IERC20;

    const tokenName: string = "Erc20my";
    const tokenSymbol: string = "EMY";
    const tokenDecimals: number = 18;
    const tokenTotalSupply: any = ethers.BigNumber.from("1000000000000000000000000");

    const coolDown: number = 10;
    const freeze: number = 20;
    const pool: number = 210000000;

    let mt: {tree: any, leafNodes: any[]};

    const _setLPToken = async () => {
        PairErc20 = await tools._setLPToken(Erc20myInstance, StakeEmyInstance, Router, owner.address, '10000000000000000000', '10000000');
    }

    before(async () => {
        [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();
        StakeEmy = await ethers.getContractFactory("StakeEmy");
        Erc20my = await ethers.getContractFactory("Erc20my");
        MyDao = await ethers.getContractFactory("MyDao");
        Router = await ethers.getContractAt("IUniswapV2Router02", constants.uniswapRouterAddress);
        mt = tree.getTree([owner.address, addr1.address, addr2.address]);

    });

    beforeEach(async () => {
        Erc20myInstance = await Erc20my.deploy(tokenName, tokenSymbol, tokenDecimals, tokenTotalSupply);
        await Erc20myInstance.deployed();
        StakeEmyInstance = await StakeEmy.deploy(Erc20myInstance.address, pool, coolDown, freeze, buf2hex(mt.tree.getRoot()));
        await StakeEmyInstance.deployed();
        
        MyDaoInstance = await MyDao.deploy(owner.address, StakeEmyInstance.address, 50, 50);
        await MyDaoInstance.deployed();
        await StakeEmyInstance.setDao(MyDaoInstance.address);
        await Erc20myInstance.setMinter(StakeEmyInstance.address);
    });

    describe("balanceOf", function () {
        it("Should return 0 for a non-existent account", async function () {
            expect(await StakeEmyInstance.balanceOf(addr1.address)).to.equal(0);
        });
    });

    describe("stake", function () {
        it("Should stake tokens", async function () {
            await _setLPToken();
            await PairErc20.approve(StakeEmyInstance.address, 100);
            await StakeEmyInstance.stake(100, mt.tree.getHexProof(keccak256(owner.address)));
            expect(await StakeEmyInstance.balanceOf(owner.address)).to.equal(100);
            expect(await StakeEmyInstance.allStaked()).to.equal(100);
        });

        it("Should stake tokens with a different amount", async function () {
            await _setLPToken();

            await PairErc20.approve(StakeEmyInstance.address, 100);
            await StakeEmyInstance.stake(100, mt.tree.getHexProof(keccak256(owner.address)));

            await PairErc20.approve(StakeEmyInstance.address, 100);
            await StakeEmyInstance.stake(100, mt.tree.getHexProof(keccak256(owner.address)));

            expect(await StakeEmyInstance.balanceOf(owner.address)).to.equal(200);
            expect(await StakeEmyInstance.allStaked()).to.equal(200);
        });

        it("Should fail if not enough tokens are approved", async function () {
            await StakeEmyInstance.setLPToken(PairErc20.address);

            await expect(StakeEmyInstance.stake(100, mt.tree.getHexProof(keccak256(owner.address)))).to.be.revertedWith("ds-math-sub-underflow");
        });

        it("Should fail if lpToken not set", async function () {
            await expect(StakeEmyInstance.stake(100, mt.tree.getHexProof(keccak256(owner.address)))).to.be.revertedWith("lpToken not set");
        });

        it("Should fail if not enough tokens are available", async function () {
            await _setLPToken();
            await PairErc20.connect(addr1).approve(StakeEmyInstance.address, 100);
            await expect(StakeEmyInstance.connect(addr1).stake(100, mt.tree.getHexProof(keccak256(addr1.address)))).to.be.revertedWith("ds-math-sub-underflow");
        });
    });

    describe("unstake", function () {
        it("Should unstake tokens", async function () {
            await _setLPToken();

            const stake = 100;
            await PairErc20.approve(StakeEmyInstance.address, stake);
            await StakeEmyInstance.stake(stake, mt.tree.getHexProof(keccak256(owner.address)));
            await testTools._increaseTime(freeze);
            await StakeEmyInstance.unstake(stake);
            expect(await StakeEmyInstance.balanceOf(owner.address)).to.equal(0);
            expect(await StakeEmyInstance.allStaked()).to.equal(0);
        });

        it("Should unstake & claim tokens", async function () {
            await _setLPToken();

            const stake = 100;
            const initialBalance = await Erc20myInstance.balanceOf(owner.address) || 0;
            await PairErc20.approve(StakeEmyInstance.address, stake);
            const timestampBeforeStakeOwner = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await StakeEmyInstance.stake(stake, mt.tree.getHexProof(keccak256(owner.address)));

            await testTools._mineBlockByTime(timestampBeforeStakeOwner + 3 * coolDown);

            let tx = await StakeEmyInstance.unstake(stake);
            await tx.wait();
            expect(await Erc20myInstance.balanceOf(owner.address)).to.equal(initialBalance.add(pool * 3));
        });

        it("Should not unstake if not enough time has passed", async function () {
            await _setLPToken();

            const stake = 100;
            await PairErc20.approve(StakeEmyInstance.address, stake);
            await StakeEmyInstance.stake(stake, mt.tree.getHexProof(keccak256(owner.address)));

            await expect(StakeEmyInstance.unstake(stake)).to.be.revertedWith("Tokens still frozen");
        });

        it("Should fail if not enough tokens are staked", async function () {
            await _setLPToken();

            const stake = 100;
            await PairErc20.approve(StakeEmyInstance.address, stake);
            await expect(StakeEmyInstance.unstake(stake)).to.be.revertedWith("Not enough balance");
        });

        it("Should fail if not set lpToken", async function () {
            await expect(StakeEmyInstance.unstake(100)).to.be.revertedWith("lpToken not set");
        });
    });

    describe("claim", function () {
        it("Should claim tokens", async function () {
            await _setLPToken();
            const initialBalance = await Erc20myInstance.balanceOf(owner.address) || 0;
            const stake = 100;

            await PairErc20.approve(StakeEmyInstance.address, stake);
            await StakeEmyInstance.stake(stake, mt.tree.getHexProof(keccak256(owner.address)));

            await ethers.provider.send("evm_increaseTime", [coolDown]);
            await ethers.provider.send("evm_mine");

            await StakeEmyInstance.claim();
            expect(await Erc20myInstance.balanceOf(owner.address)).to.equal(initialBalance.add(pool));
        });

        it("Should not claim tokens if not enough time has passed", async function () {
            await _setLPToken();
            const initialBalance = await Erc20myInstance.balanceOf(owner.address) || 0;
            const stake = 100;

            await PairErc20.approve(StakeEmyInstance.address, stake);
            await StakeEmyInstance.stake(stake, mt.tree.getHexProof(keccak256(owner.address)));

            await StakeEmyInstance.claim();
            expect(await Erc20myInstance.balanceOf(owner.address)).to.equal(initialBalance);
        });

        it("Should not claim tokens if not enough tokens are staked", async function () {
            await _setLPToken();
            await expect(StakeEmyInstance.claim()).to.be.revertedWith("No balance to claim");
        });

        it("Should claim tokens divided by the number of stakers", async function () {
            await _setLPToken();

            const initialBalance = await Erc20myInstance.balanceOf(owner.address) || 0;
            const stake = 100;
            const stake1 = 50;
            const stake2 = 25;

            await PairErc20.approve(StakeEmyInstance.address, stake);
            await PairErc20.transfer(addr1.address, stake1);
            await PairErc20.transfer(addr2.address, stake2);
            await PairErc20.connect(addr1).approve(StakeEmyInstance.address, stake1);
            await PairErc20.connect(addr2).approve(StakeEmyInstance.address, stake2);

            const timestampBeforeStakeOwner = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await StakeEmyInstance.stake(stake, mt.tree.getHexProof(keccak256(owner.address)));

            const timestampBeforeStake1 = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await StakeEmyInstance.connect(addr1).stake(stake1, mt.tree.getHexProof(keccak256(addr1.address)));

            await testTools._mineBlockByTime(timestampBeforeStakeOwner + 3 * coolDown);
            await StakeEmyInstance.claim();

            await testTools._mineBlockByTime(timestampBeforeStake1 + 4 * coolDown);
            await StakeEmyInstance.connect(addr1).claim();

            const timestampBeforeStake2 = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await StakeEmyInstance.connect(addr2).stake(stake2, mt.tree.getHexProof(keccak256(addr2.address)));

            await testTools._mineBlockByTime(timestampBeforeStake2 + 5 * coolDown);
            await StakeEmyInstance.connect(addr2).claim();
            await StakeEmyInstance.claim();

            const balance1 = await Erc20myInstance.balanceOf(addr1.address);
            const balance2 = await Erc20myInstance.balanceOf(addr2.address);
            const balanceOwner = await Erc20myInstance.balanceOf(owner.address);

            const bo = initialBalance.add(Math.round(pool * stake * 4 / (stake + stake1)) + Math.round(pool * stake * 5 / (stake + stake1 + stake2)));
            const b1 = Math.round(pool * stake1 * 4 / (stake + stake1));
            const b2 = Math.round(pool * stake2 * 5 / (stake + stake1 + stake2));

            expect(0).to.equals(bo.sub(balanceOwner).toNumber());
            expect(0).to.equals(balance1.sub(b1).toNumber());
            expect(0).to.equals(balance2.sub(b2).toNumber());
        });

        it("Should not be possible to claim is lpToken is not set", async function () {
            await expect(StakeEmyInstance.claim()).to.be.revertedWith("lpToken not set");
        });
    });

    describe("Set LP token", function () {
        it("Should set LP token", async function () {
            await StakeEmyInstance.setLPToken(Erc20myInstance.address);
            expect(await StakeEmyInstance.lpToken()).to.equal(Erc20myInstance.address);
        });

        it("Should not be possible to set LP token if not admin or owner", async function () {
            await expect(StakeEmyInstance.connect(addr1).setLPToken(Erc20myInstance.address)).to.be.revertedWith("Only owner or admin allowed");
        });

        it("Should not be possible to set lp token if it is already set", async function () {
            await StakeEmyInstance.setLPToken(Erc20myInstance.address);
            await expect(StakeEmyInstance.setLPToken(Erc20myInstance.address)).to.be.revertedWith("lpToken already set");
        });
    });

    describe("Set pool", function () {
        it("Should set pool", async function () {
            await StakeEmyInstance.setPool(100);
            expect(await StakeEmyInstance.pool()).to.equal(100);
        });
    });

    describe("Set admin", function () {
        it("Should set admin", async function () {
            await StakeEmyInstance.setAdmin(addr1.address);
            await StakeEmyInstance.connect(addr1).setLPToken(Erc20myInstance.address);
        });

        it("Should not be possible to set admin if not owner", async function () {
            await expect(StakeEmyInstance.connect(addr1).setAdmin(addr2.address)).to.be.revertedWith("VM Exception while processing transaction: revert");
        });
    });

    describe("Claimable", function () {
        it("Should return true if the LP token is set", async function () {
            await _setLPToken();
            const stake = 100;

            await PairErc20.approve(StakeEmyInstance.address, stake);
            await StakeEmyInstance.stake(stake, mt.tree.getHexProof(keccak256(owner.address)));

            await ethers.provider.send("evm_increaseTime", [coolDown]);
            await ethers.provider.send("evm_mine");

            expect(await StakeEmyInstance.claimable()).to.equal(pool);
        });

    });

    describe("Set root", function () {
        it("Should set root", async function () {
            await _setLPToken();
            const stake = 100;
            const stake1 = 150;

            await PairErc20.approve(StakeEmyInstance.address, stake * 10);
            await PairErc20.transfer(addr1.address, stake1);
            await PairErc20.connect(addr1).approve(StakeEmyInstance.address, stake1);
            await PairErc20.transfer(addr2.address, stake1);
            await PairErc20.connect(addr2).approve(StakeEmyInstance.address, stake1);

            await StakeEmyInstance.connect(addr2).stake(1, mt.tree.getHexProof(keccak256(addr2.address)));
            await StakeEmyInstance.connect(addr1).stake(100, mt.tree.getHexProof(keccak256(addr1.address)));

            const newMt = tree.getTree([owner.address, addr1.address]);

            const jsonAbi = ["function setRoot(bytes32 _root)"];
            const iface = new ethers.utils.Interface(jsonAbi);
            const calldata = iface.encodeFunctionData('setRoot',[buf2hex(newMt.tree.getRoot())]);

            const proposalId = await MyDaoInstance.addProposal(calldata, StakeEmyInstance.address, "description");
            const now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await MyDaoInstance.connect(addr1).vote(proposalId.value, true);

            await ethers.provider.send("evm_mine", [now + 100]);

            await MyDaoInstance.finishProposal(proposalId.value);

            await expect(StakeEmyInstance.stake(100, newMt.tree.getHexProof(keccak256(owner.address)))).to.be.not.reverted;
            await expect(StakeEmyInstance.connect(addr2).stake(50, newMt.tree.getHexProof(keccak256(addr2.address)))).to.be.revertedWith('Invalid proof');
        });
    });
});