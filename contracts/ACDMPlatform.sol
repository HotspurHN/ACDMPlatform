//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./interfaces/IMintable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ACDMPlatform {

    address public immutable acdmToken;
    address public immutable owner;
    uint256 public immutable roundTime;
    uint256 public immutable baseAcdmTokenPool;
    uint256 public immutable baseRate;
    uint256 public roundStart;
    uint256 public acdmTokenPool;
    uint256 public tradeRate;

    uint32 public ref1Tax = 50;
    uint32 public ref2Tax = 30;
    uint24 public acdmTax = 25;
    bool public isSaleRound = true;
    address public dao;

    Order[] public orders;

    mapping(address => bool) public registeredUsers;
    mapping(address => address) public referrers;

    struct Order{
        uint256 amount;
        uint256 price;
        address payable owner;
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
        uint256 decimals = ERC20(_acdmToken).decimals();
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

    function startSaleRound() onlyTradeRound public {
        require(block.timestamp >= roundStart + roundTime, "Trade round is not finished yet");
        tradeRate =  tradeRate * 103 / 100 + 40000;
        isSaleRound = true;
        acdmTokenPool = baseAcdmTokenPool;
        roundStart = block.timestamp;
    }
    function startTradeRound() onlySaleRound public {
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
            price: _ethValue / _acdmTokenAmount
        });
        orders.push(order);
        ERC20(acdmToken).transferFrom(msg.sender, address(this), _acdmTokenAmount);
        checkRound();
        return orderId;
    }
    function removeOrder(uint256 _id) onlyRegistered external {
        require(_id < orders.length, "Order not found");
        Order memory order = orders[_id];
        require(order.amount > 0, "Order already closed");
        orders[_id].amount = 0;
        ERC20(acdmToken).transfer(msg.sender, order.amount);
        checkRound();
    }
    function redeemOrder(uint256 _id) external onlyRegistered onlyTradeRound payable {
        require(_id < orders.length, "Order not found");
        Order storage order = orders[_id];
        require(order.amount > 0, "Order is closed");
        uint256 amount = msg.value / order.price;
        require(amount <= order.amount, "Not enough ACDM Tokens");
        order.amount -= amount;
        if (referrers[msg.sender] != address(0)){
            ERC20(acdmToken).transfer(referrers[msg.sender], amount * acdmTax / 1000);
            if (referrers[referrers[msg.sender]] != address(0)){
                ERC20(acdmToken).transfer(referrers[referrers[msg.sender]], amount * acdmTax / 1000);
            }
        }
        payable(order.owner).transfer(msg.value);
        ERC20(acdmToken).transfer(msg.sender, amount - amount * 2 * acdmTax / 1000);
        checkRound();
    }
    function buyACDMToken() external onlyRegistered onlySaleRound payable {
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
        checkRound();
    }
    function setTaxes(uint32 _tax1, uint32 _tax2, uint24 _acdmTax) external onlyDao {
        ref1Tax = _tax1;
        ref2Tax = _tax2;
        acdmTax = _acdmTax;
    }

    function setDao(address _dao) external onlyOwner {
        dao = _dao;
    }

    function checkRound() private{
        if (block.timestamp >= roundStart + roundTime){
            if (isSaleRound){
                startTradeRound();
            } else {
                startSaleRound();
            }
        }
    }
}