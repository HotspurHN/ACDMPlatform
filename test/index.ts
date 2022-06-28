import { expect } from "chai";
import { Erc20my } from "../typechain-types/contracts/Erc20my";
const { ethers } = require("hardhat");

describe("Erc20my", function () {

  const tokenName: string = "Erc20my";
  const tokenSymbol: string = "EMY";
  const tokenDecimals: number = 18;
  const tokenTotalSupply: number = 1000000;

  let owner: any;
  let addr1: any;

  let Erc20my: any;
  let Erc20myInstance: Erc20my;

  before(async () => {
    [owner, addr1] = await ethers.getSigners();
    Erc20my = await ethers.getContractFactory("Erc20my");
  });

  beforeEach(async () => {
    Erc20myInstance = await Erc20my.deploy(tokenName, tokenSymbol, tokenDecimals, tokenTotalSupply);
    await Erc20myInstance.deployed();
  });

  it("Should set correct values on deploy", async function () {
    expect(await Erc20myInstance.name()).to.equal(tokenName);
    expect(await Erc20myInstance.symbol()).to.equal(tokenSymbol);
    expect(await Erc20myInstance.decimals()).to.equal(tokenDecimals);
    expect(await Erc20myInstance.totalSupply()).to.equal(tokenTotalSupply);
  });

  describe("burn", function () {
    it("Should burn tokens", async function () {
      await Erc20myInstance.setMinter(owner.address);
      await Erc20myInstance.burn(owner.address, 100);
      expect(await Erc20myInstance.balanceOf(owner.address)).to.equal(tokenTotalSupply - 100);
      expect(await Erc20myInstance.totalSupply()).to.equal(tokenTotalSupply - 100);
    });

    it("Should fail when trying to burn more than balance", async function () {
      await Erc20myInstance.setMinter(owner.address);
      await expect(Erc20myInstance.burn(owner.address, tokenTotalSupply + 1)).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should be possible only for minter", async function () {
      await expect(Erc20myInstance.connect(addr1).burn(owner.address, 1)).to.be.revertedWith("Only minter allowed");
    });
  });

  describe("setMinter", function () {
    it("Should set minter", async function () {
      await Erc20myInstance.setMinter(addr1.address);
      expect(await Erc20myInstance.minter()).to.equal(addr1.address);
    });

    it("Should fail when trying to set minter to non-owner", async function () {
      await expect(Erc20myInstance.connect(addr1).setMinter(addr1.address)).to.be.revertedWith("Only owner allowed");
    });
  });
});