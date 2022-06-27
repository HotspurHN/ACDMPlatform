//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interfaces/IMintable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Erc20my is ERC20, IMintable {

    uint8 public decimalsAmount;

    address public owner;
    address public minter;

    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowed;

    modifier onlyOwner {
      require(msg.sender == owner, "Only owner allowed");
      _;
   }
    modifier onlyMinter {
      require(msg.sender == minter, "Only minter allowed");
      _;
   }

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalSupply) ERC20(_name, _symbol)  {
        decimalsAmount = _decimals;
        _mint(msg.sender, _totalSupply);
        owner = msg.sender;
    }

    function mint(address _to, uint256 _value) external override(IMintable) onlyMinter returns (bool) {
        _mint(_to, _value);
        return true;
    }

    function burn(address _from, uint256 _value) external override(IMintable) onlyMinter returns (bool) {
        _burn(_from, _value);
        return true;
    }

    function setMinter(address _minter) public onlyOwner {
        minter = _minter;
    }

    function decimals() public view override(ERC20) returns (uint8) {
        return decimalsAmount;
    }
}