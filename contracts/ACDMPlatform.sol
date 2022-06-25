//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./interfaces/IErc20.sol";
import "./interfaces/IMintable.sol";

contract ACDMPlatform {

    uint256 public immutable roundTime;
    uint256 public immutable baseAcdmTokenPool;
    uint256 public immutable baseRate;
    uint256 public roundStart;
    uint256 public acdmTokenPool;
    uint256 public tradeRate;

    uint256 public ref1Tax = 50;
    uint256 public ref2Tax = 30;
    uint256 public acdmTax = 25;

    bool public isSaleRound = true;

    address public immutable acdmToken;
    address public immutable owner;
    address public dao;

    Order[] public orders;

    mapping(address => bool) public registeredUsers;
    mapping(address => address) public referrers;

    struct Order{
        uint256 amount;
        uint256 price;
        address payable owner;
        bool isOpen;
    }

    modifier onlyRegistered() {
        require(registeredUsers[msg.sender], "Only for registered");
        _;
    }

    modifier onlySaleRound() {
        require(isSaleRound, "Could be call only in sale round");
        _;
    }

    modifier onlyTradeRound() {
        require(!isSaleRound, "Could be call only in trade round");
        _;
    }

    modifier onlyOwner(){
        require(msg.sender == owner, "Only owner allowed");
        _;
    }

    modifier onlyDao(){
        require(msg.sender == dao, "Only dao allowed");
        _;
    }

    constructor(address _acdmToken, uint256 _roundTime) {
        acdmToken = _acdmToken;
        roundTime = _roundTime;
        roundStart = block.timestamp;
        tradeRate = 100000;
        uint256 decimals = IErc20(_acdmToken).getDecimals();
        baseRate = 10 ** decimals * tradeRate ** 2;
        acdmTokenPool = 100000 * 10 ** decimals;
        baseAcdmTokenPool = acdmTokenPool;
        owner = msg.sender;
    }

    function register(address _referrer) external {
        require(!registeredUsers[msg.sender], "Already registered");
        require(_referrer == address(0) || registeredUsers[_referrer], "Referrer not registered");
        registeredUsers[msg.sender] = true;
        referrers[msg.sender] = _referrer;
    }

    function startSaleRound() onlyTradeRound external {
        require(block.timestamp >= roundStart + roundTime, "Trade round is not finished yet");
        tradeRate =  tradeRate * 103 / 100 + 40000;
        isSaleRound = true;
        acdmTokenPool = baseAcdmTokenPool;
        roundStart = block.timestamp;
    }
    function startTradeRound() onlySaleRound external {
        require(block.timestamp >= roundStart + roundTime, "Sale round is not finished yet");
        isSaleRound = false;
        roundStart = block.timestamp;
    }
    function addOrder(uint256 _acdmTokenAmount, uint256 _ethValue) onlyRegistered onlyTradeRound external returns(uint256) {
        require(_acdmTokenAmount > 0, "Amount must be greater than 0");
        require(_ethValue > 0, "Value must be greater than 0");
        uint256 orderId = orders.length;
        Order memory order = Order({
            owner: payable (msg.sender),
            amount: _acdmTokenAmount,
            price: _ethValue / _acdmTokenAmount,
            isOpen: true
        });
        orders.push(order);
        IErc20(acdmToken).transferFrom(msg.sender, address(this), _acdmTokenAmount);
        return orderId;
    }
    function removeOrder(uint256 _id) onlyRegistered external {
        require(_id < orders.length, "Order not found");
        Order storage order = orders[_id];
        require(order.isOpen, "Order already closed");
        IErc20(acdmToken).transfer(msg.sender, order.amount);
        order.isOpen = false;
    }
    function redeemOrder(uint256 _id) onlyRegistered onlyTradeRound external payable {
        require(_id < orders.length, "Order not found");
        Order storage order = orders[_id];
        require(order.isOpen, "Order is closed");
        uint256 amount = msg.value / order.price;
        require(amount <= order.amount, "Not enough ACDM Tokens");
        if (order.amount == amount){
            order.isOpen = false;
        }
        order.amount -= amount;
        if (referrers[msg.sender] != address(0)){
            IErc20(acdmToken).transfer(referrers[msg.sender], amount * acdmTax / 1000);
            if (referrers[referrers[msg.sender]] != address(0)){
                IErc20(acdmToken).transfer(referrers[referrers[msg.sender]], amount * acdmTax / 1000);
            }
        }
        payable(order.owner).transfer(msg.value);
        IErc20(acdmToken).transfer(msg.sender, amount - amount * 2 * acdmTax / 1000);
    }
    function buyACDMToken() onlyRegistered onlySaleRound external payable {
        uint256 amount = (msg.value * baseRate) / (tradeRate * 10 ** 18);
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= acdmTokenPool, "Not enough tokens in pool");
        acdmTokenPool -= amount;
        IMintable(acdmToken).mint(msg.sender, amount);
        if (referrers[msg.sender] != address(0)){
            uint256 tax = msg.value * ref1Tax / 1000;
            payable(referrers[msg.sender]).transfer(tax);
            if (referrers[referrers[msg.sender]] != address(0)){
                uint256 tax2 = msg.value * ref2Tax / 1000;
                payable(referrers[referrers[msg.sender]]).transfer(tax2);
            }
        }
    }
    function setTaxes(uint256 _tax1, uint256 _tax2, uint256 _acdmTax) onlyDao external {
        ref1Tax = _tax1;
        ref2Tax = _tax2;
        acdmTax = _acdmTax;
    }

    function setDao(address _dao) onlyOwner external {
        dao = _dao;
    }
}