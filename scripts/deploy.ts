import { ethers, run } from "hardhat";
import { StakeEmy } from "../typechain-types/StakeEmy";
import { Erc20my } from "../typechain-types/Erc20my";
import { IUniswapV2Router02 } from "../typechain-types/uniswap/IUniswapV2Router02";
import { IUniswapV2Factory } from "../typechain-types/uniswap/IUniswapV2Factory";
import { IErc20 } from "../typechain-types/interfaces/IErc20";
import tools from "./tools";
import constants from "./constants";

async function main() {
  const Erc20my = await ethers.getContractFactory("Erc20my");
  const Erc20myInstance = <Erc20my>await Erc20my.deploy("Erc20my", "EMY", 18, '1000000000000000000000000');
  await Erc20myInstance.deployed();
  
  const ACDMTokenInstance = await Erc20my.deploy("ACADEM Coin", "ACDM", 6, '0');
  await ACDMTokenInstance.deployed();

  const StakeEmy = await ethers.getContractFactory("StakeEmy");
  const StakeEmyInstance = <StakeEmy>await StakeEmy.deploy(Erc20myInstance.address, '10000000000000000', 120, 260, { gasPrice: '18813487855' });
  await StakeEmyInstance.deployed();
  await Erc20myInstance.setMinter(StakeEmyInstance.address);

  const Router = <IUniswapV2Router02>await ethers.getContractAt("IUniswapV2Router02", constants.uniswapRouterAddress);
  const pairErc20 = await tools._setLPToken(Erc20myInstance, StakeEmyInstance, Router, 
    (await ethers.getSigners())[0].address, '10000000000000000000000', '10000000000000000');

  const MyDao = await ethers.getContractFactory("MyDao");
  const MyDaoInstance = await MyDao.deploy((await ethers.getSigners())[0].address, pairErc20.address, 1000, 150);
  await MyDaoInstance.deployed();

  console.log("verifing");
  try {
    await run("verify:verify", {
      address: Erc20myInstance.address,
      constructorArguments: [
        "Erc20my",
        "EMY",
        18,
        '1000000000000000000000000'
      ],
    });
  }
  catch (ex) {
    console.log("verify failed", Erc20myInstance.address);
  }

  try {
    await run("verify:verify", {
      address: MyDaoInstance.address,
      constructorArguments: [
        (await ethers.getSigners())[0].address, Erc20myInstance.address, 1000, 150
      ],
    });
  }
  catch (ex) {
    console.log("verify failed", MyDaoInstance.address);
  }

  console.log("Erc20my deployed to:", Erc20myInstance.address);
  console.log("MyDao deployed to:", MyDaoInstance.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
