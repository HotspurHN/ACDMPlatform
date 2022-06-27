//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IStake {
    function balanceOf(address _owner) external view returns (uint256);
}