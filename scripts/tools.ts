const { ethers } = require("hardhat");
import { StakeEmy } from "../typechain-types/contracts/StakeEmy";
import { Erc20my } from "../typechain-types/contracts/Erc20my";
import { IUniswapV2Router02 } from "../typechain-types/contracts/uniswap/IUniswapV2Router02";
import constants from "../scripts/constants";
const Web3 = require('web3');
const web3 = new Web3();
import { IERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";

export default {
    _setLPToken: async (
        Erc20myInstance: Erc20my,
        StakeEmyInstance: StakeEmy,
        Router: IUniswapV2Router02,
        ownerAddress: string,
        tokenValue: string,
        ethValue: string) => {

        const time = Math.floor(Date.now() / 1000) + 200000;
        const deadline = ethers.BigNumber.from(time);

        await Erc20myInstance.approve(constants.uniswapRouterAddress,
            ethers.BigNumber.from(tokenValue));

        var tx = await Router.addLiquidityETH(
            Erc20myInstance.address,
            ethers.BigNumber.from(tokenValue),
            ethers.BigNumber.from(tokenValue),
            ethers.BigNumber.from(ethValue),
            ownerAddress,
            deadline, { value: ethers.BigNumber.from(ethValue), gasPrice: '18813487855' });
        var logs = await tx.wait();

        const pair = web3.eth.abi.decodeParameter('address', logs.logs[0].data);
        await StakeEmyInstance.setLPToken(pair);

        return await ethers.getContractAt("IERC20", pair);
    }
};