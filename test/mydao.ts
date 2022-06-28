import { expect } from "chai";
import { Erc20my } from "../typechain-types/contracts/Erc20my";
import { StakeEmy } from "../typechain-types/contracts/StakeEmy";
import { MyDao } from "../typechain-types/MyDao";
const { ethers } = require("hardhat");
import tree from "../scripts/merkletree";
import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";
const buf2hex = (x:any) => '0x'+x.toString('hex')

describe("MyDao", function () {

    const tokenName: string = "Erc20my";
    const tokenSymbol: string = "EMY";
    const tokenDecimals: number = 18;
    const tokenTotalSupply: number = 1000000;

    const voteDuration: number = 1000;
    const voteQuorum: number = 150;

    let owner: any;
    let addr1: any;
    let addr2: any;
    let addr3: any;

    let Erc20my: any;
    let Erc20myInstance: Erc20my;
    let MyDao: any;
    let MyDaoInstance: MyDao;
    let StakeEmy: any;
    let StakeEmyInstance: StakeEmy;
    let mt: any;

    let calldata: any;

    before(async () => {
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        Erc20my = await ethers.getContractFactory("Erc20my");
        MyDao = await ethers.getContractFactory("MyDao");
        StakeEmy = await ethers.getContractFactory("StakeEmy");

        const jsonAbi = ["function mint(address _to, uint256 _amount)"];
        const iface = new ethers.utils.Interface(jsonAbi);
        calldata = iface.encodeFunctionData('mint',[addr3.address, 10001]);
        mt = tree.getTree([owner.address, addr1.address, addr2.address]);
    });

    beforeEach(async () => {
        Erc20myInstance = await Erc20my.deploy(tokenName, tokenSymbol, tokenDecimals, tokenTotalSupply);
        await Erc20myInstance.deployed();
        StakeEmyInstance = await StakeEmy.deploy(Erc20myInstance.address, '10000000', 120, 260, buf2hex(mt.tree.getRoot()));
        await StakeEmyInstance.deployed();
        await StakeEmyInstance.setLPToken(Erc20myInstance.address);
        MyDaoInstance = await MyDao.deploy(owner.address, StakeEmyInstance.address, voteQuorum, voteDuration);
        await MyDaoInstance.deployed();
        await StakeEmyInstance.setDao(MyDaoInstance.address);
        await Erc20myInstance.setMinter(MyDaoInstance.address);
        await Erc20myInstance.connect(owner).transfer(addr1.address, 1000);
        await Erc20myInstance.connect(owner).transfer(addr2.address, 1000);
        await Erc20myInstance.connect(owner).transfer(addr3.address, 1000);
    });

    describe("addProposal", function () {
        it("should add proposal", async function () {
            const value = 100;
            await Erc20myInstance.approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.stake(value, mt.tree.getHexProof(keccak256(owner.address)));
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            expect(proposalId.value).to.equal(0);
        });
        it("should be possible to add proposal only for chairman", async function () {
            const value = 100;
            await Erc20myInstance.approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.stake(value, mt.tree.getHexProof(keccak256(owner.address)));
            await expect(MyDaoInstance.connect(addr1).addProposal(calldata, Erc20myInstance.address, "description")).to.be.revertedWith("Only chairman allowed");
        });
    });

    describe("vote", function () {
        it("should vote", async function () {
            const value = 100;
            await Erc20myInstance.connect(addr1).approve(StakeEmyInstance.address, value - 10);
            await Erc20myInstance.connect(addr2).approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.connect(addr1).stake(value - 10, mt.tree.getHexProof(keccak256(addr1.address)));
            await StakeEmyInstance.connect(addr2).stake(value, mt.tree.getHexProof(keccak256(addr2.address)));
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            await MyDaoInstance.connect(addr1).vote(proposalId.value, false);
            await MyDaoInstance.connect(addr2).vote(proposalId.value, true);
            const proposal = await MyDaoInstance.proposals(proposalId.value);
            expect(proposal.votesYes).to.equal(value);
            expect(proposal.votesNo).to.equal(value - 10);
        });
        it ("Should not vote if wrong index", async function () {
            await expect(MyDaoInstance.vote(100, false)).to.be.revertedWith("Invalid proposal index");
        });
        it ("Should not be possible to vote as chairman", async function () {
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            await expect(MyDaoInstance.vote(proposalId.value, false)).to.be.revertedWith("Chairman cannot vote");
        });
        it("Should not be possible to vote twice", async function () {
            const value = 100;
            await Erc20myInstance.connect(addr1).approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.connect(addr1).stake(value, mt.tree.getHexProof(keccak256(addr1.address)));
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            await MyDaoInstance.connect(addr1).vote(proposalId.value, false);
            await expect(MyDaoInstance.connect(addr1).vote(proposalId.value, false)).to.be.revertedWith("You have already voted");
        });

        it("should not be possible to vote after vote duration", async function () {
            const value = 100;
            await Erc20myInstance.connect(addr1).approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.connect(addr1).stake(value, mt.tree.getHexProof(keccak256(addr1.address)));
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            const now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await ethers.provider.send("evm_mine", [now + voteDuration]);
            await expect(MyDaoInstance.connect(addr1).vote(proposalId.value, false)).to.be.revertedWith("Voting period has ended");
        });
    });

    describe("finishProposal", function () {
        it("should finish proposal and execute function", async function () {
            const value = 100;
            await Erc20myInstance.connect(addr1).approve(StakeEmyInstance.address, value - 10);
            await Erc20myInstance.connect(addr2).approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.connect(addr1).stake(value - 10, mt.tree.getHexProof(keccak256(addr1.address)));
            await StakeEmyInstance.connect(addr2).stake(value, mt.tree.getHexProof(keccak256(addr2.address)));
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            const now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await MyDaoInstance.connect(addr1).vote(proposalId.value, false);
            await MyDaoInstance.connect(addr2).vote(proposalId.value, true);

            await ethers.provider.send("evm_mine", [now + voteDuration]);

            await MyDaoInstance.finishProposal(proposalId.value);
            const proposal = await MyDaoInstance.proposals(proposalId.value);
            expect(proposal.votesYes).to.equal(value);
            expect(proposal.votesNo).to.equal(value - 10);
            expect(await Erc20myInstance.balanceOf(addr3.address)).to.equal(11001);
        });

        it("should finish proposal and not execute function with no quorum", async function () {
            const value = 100;
            await Erc20myInstance.connect(addr1).approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.connect(addr1).stake(value, mt.tree.getHexProof(keccak256(addr1.address)));
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            const now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await MyDaoInstance.connect(addr1).vote(proposalId.value, true);

            await ethers.provider.send("evm_mine", [now + voteDuration]);

            await MyDaoInstance.finishProposal(proposalId.value);
            const proposal = await MyDaoInstance.proposals(proposalId.value);
            expect(proposal.votesYes).to.equal(value);
            expect(await Erc20myInstance.balanceOf(addr3.address)).to.equal(1000);
        });

        it("should finish proposal and not execute when no more than yes", async function () {
            const value = 100;
            await Erc20myInstance.connect(addr1).approve(StakeEmyInstance.address, value - 10);
            await Erc20myInstance.connect(addr2).approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.connect(addr1).stake(value - 10, mt.tree.getHexProof(keccak256(addr1.address)));
            await StakeEmyInstance.connect(addr2).stake(value, mt.tree.getHexProof(keccak256(addr2.address)));
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            const now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await MyDaoInstance.connect(addr1).vote(proposalId.value, true);
            await MyDaoInstance.connect(addr2).vote(proposalId.value, false);

            await ethers.provider.send("evm_mine", [now + voteDuration]);

            await MyDaoInstance.finishProposal(proposalId.value);
            const proposal = await MyDaoInstance.proposals(proposalId.value);
            expect(proposal.votesYes).to.equal(value - 10);
            expect(proposal.votesNo).to.equal(value);
            expect(await Erc20myInstance.balanceOf(addr3.address)).to.equal(1000);
        });
        it("should not be possible to finish not existing proposal", async function () {
            await expect(MyDaoInstance.finishProposal(100)).to.be.revertedWith("Invalid proposal index");
        });
        it("should not be possible to finish proposal twice", async function () {
            const value = 100;
            await Erc20myInstance.connect(addr1).approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.connect(addr1).stake(value, mt.tree.getHexProof(keccak256(addr1.address)));
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            const now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await MyDaoInstance.connect(addr1).vote(proposalId.value, true);
            await ethers.provider.send("evm_mine", [now + voteDuration]);
            await MyDaoInstance.finishProposal(proposalId.value);
            await expect(MyDaoInstance.finishProposal(proposalId.value)).to.be.revertedWith("Proposal has already finished");
        });
        it("should not be possible to finish proposal before vote duration", async function () {
            const value = 100;
            await Erc20myInstance.connect(addr1).approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.connect(addr1).stake(value, mt.tree.getHexProof(keccak256(addr1.address)));
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            await MyDaoInstance.connect(addr1).vote(proposalId.value, true);
            await expect(MyDaoInstance.finishProposal(proposalId.value)).to.be.revertedWith("Voting period has not yet ended");
        });
        it("should be reverted proposal if bad call", async function () {
            const value = 180;
            await Erc20myInstance.setMinter(addr1.address);
            await Erc20myInstance.connect(addr1).approve(StakeEmyInstance.address, value);
            await StakeEmyInstance.connect(addr1).stake(value, mt.tree.getHexProof(keccak256(addr1.address)));
            const proposalId = await MyDaoInstance.addProposal(calldata, Erc20myInstance.address, "description");
            const now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
            await MyDaoInstance.connect(addr1).vote(proposalId.value, true);
            await ethers.provider.send("evm_mine", [now + voteDuration]);
            await expect(MyDaoInstance.finishProposal(proposalId.value)).to.be.revertedWith("Only minter allowed");
        });
    });
});