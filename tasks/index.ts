import "dotenv/config";
import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import { Contract } from "@ethersproject/contracts";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export function tasks() {

  const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
  const CONTRACT = process.env.CONTRACT || '';
  const CONTRACTDAO = process.env.CONTRACTDAO || '';

  const initBlockchainTask = async (hre: HardhatRuntimeEnvironment): Promise<Contract> => {
    let provider = hre.ethers.provider;
    let signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);

    const Erc20my = await hre.ethers.getContractFactory("Erc20my");
    const Erc20myInstance = await Erc20my.attach(CONTRACT).connect(signer);

    return Erc20myInstance;
  }
  const initBlockchainDaoTask = async (hre: HardhatRuntimeEnvironment): Promise<Contract> => {
    let provider = hre.ethers.provider;
    let signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);

    const MyDao = await hre.ethers.getContractFactory("MyDao");
    const MyDaoInstance = await MyDao.attach(CONTRACTDAO).connect(signer);

    return MyDaoInstance;
  }

  task("transfer", "Transfer tokens")
    .addParam("to", "string")
    .addParam("value", "integer")
    .setAction(async ({ to, value }, hre) => {
      const instance = await initBlockchainTask(hre);
      await instance.transfer(to, value);
    });

  task("transferfrom", "Transfer tokens from another account")
    .addParam("from", "string")
    .addParam("to", "string")
    .addParam("value", "integer")
    .setAction(async ({ from, to, value }, hre) => {
      const instance = await initBlockchainTask(hre);
      await instance.transferFrom(from, to, value);
    });

  task("approve", "Approve tokens for another account")
    .addParam("spender", "string")
    .addParam("value", "integer")
    .setAction(async ({ spender, value }, hre) => {
      const instance = await initBlockchainTask(hre);
      await instance.approve(spender, value);
    });
  task("setminter", "Set minter")
    .addParam("address", "string")
    .setAction(async ({ address }, hre) => {
      const instance = await initBlockchainTask(hre);
      await instance.setMinter(address);
    });
    
    task("addproposalmint", "Add proposal Mint")
    .addParam("to", "string")
    .setAction(async ({ to }, hre) => {
      const instance = await initBlockchainDaoTask(hre);
      const instanceerc20 = await initBlockchainTask(hre);
      const jsonAbi = ["function mint(address _to, uint256 _amount)"];
      const iface = new hre.ethers.utils.Interface(jsonAbi);
      const calldata = iface.encodeFunctionData('mint',[to, 10001]);
      await instance.addProposal(calldata, instanceerc20.address, "function mint(address _to, uint256 _amount)");
    });
}
