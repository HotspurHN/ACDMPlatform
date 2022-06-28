//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interfaces/IMintable.sol";
import "./interfaces/IStake.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MyDao.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract StakeEmy is IStake {
    uint256 public pool;
    uint256 public coolDown;
    uint256 public startPool;
    uint256 public freezeTime;
    uint256 public allStaked;
    uint256 private lastValue;
    uint256 private lastUpdate;
    uint256 private deltaPeriod;

    bytes32 public merkleRoot;

    address private owner;
    address private admin;
    address public lpToken;
    address public rewardToken;
    address public dao;

    mapping(address => uint256) private lastValuePerAddress;
    mapping(address => uint256) private balances;
    mapping(address => uint256) private startStaking;

    event Stake(address indexed _from, uint256 _value);
    event Unstake(address indexed _to, uint256 _value);
    event Claim(address indexed _to, uint256 _value);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner allowed");
        _;
    }
    modifier onlyOwnerOrAdmin() {
        require(
            msg.sender == owner || msg.sender == admin,
            "Only owner or admin allowed"
        );
        _;
    }

    modifier onlyDao(){
        require(msg.sender == dao, "Only dao allowed");
        _;
    }

    modifier whitelistVerify(bytes32[] calldata _merkleProof){
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(MerkleProof.verify(_merkleProof, merkleRoot, leaf), "Invalid proof");
        _;
    }

    constructor(
        address _rewarToken,
        uint256 _pool,
        uint256 _coolDown,
        uint256 _freezeTime,
        bytes32 _merkleRoot
    ) {
        rewardToken = _rewarToken;
        pool = _pool;
        coolDown = _coolDown;
        owner = msg.sender;
        freezeTime = _freezeTime;
        merkleRoot = _merkleRoot;
    }

    function stake(uint256 _amount, bytes32[] calldata _merkleProof) whitelistVerify(_merkleProof) public {
        require(lpToken != address(0), "lpToken not set");
        if (balances[msg.sender] > 0) {
            _claim();
        } else {
            lastValuePerAddress[msg.sender] = lastValue;
        }
        IERC20(lpToken).transferFrom(msg.sender, address(this), _amount);
        balances[msg.sender] += _amount;
        allStaked += _amount;
        startStaking[msg.sender] = block.timestamp;
        emit Stake(msg.sender, _amount);
    }

    function unstake(uint256 _amount) public {
        require(lpToken != address(0), "lpToken not set");
        require(balances[msg.sender] >= _amount, "Not enough balance");
        require(
            startStaking[msg.sender] <= block.timestamp - freezeTime,
            "Tokens still frozen"
        );
        require(MyDao(dao).lastVotingEndTime(msg.sender) < block.timestamp, "Voting not finished");
        _claim();
        balances[msg.sender] -= _amount;
        allStaked -= _amount;
        IERC20(lpToken).transfer(msg.sender, _amount);
        emit Unstake(msg.sender, _amount);
    }

    function claimable() public view returns(uint256){
        uint256 last = lastValue + pool * (_currentPeriod() - lastUpdate) / allStaked;
        return (last - lastValuePerAddress[msg.sender]) * balanceOf(msg.sender);
    }

    function claim() public {
        require(lpToken != address(0), "lpToken not set");
        require(balances[msg.sender] > 0, "No balance to claim");
        _claim();
    }

    function setLPToken(address _lpToken) public onlyOwnerOrAdmin {
        require(lpToken == address(0), "lpToken already set");
        lpToken = _lpToken;
        startPool = block.timestamp;
    }

    function setPool(uint256 _pool) public onlyOwnerOrAdmin {
        pool = _pool;
    }

    function setAdmin(address _admin) public onlyOwner {
        admin = _admin;
    }

    function balanceOf(address _owner) public override view returns (uint256) {
        return balances[_owner];
    }

    function _claim() private {
        lastValue += (pool * (_currentPeriod() - lastUpdate)) / allStaked;
        lastUpdate = _currentPeriod();
        uint256 totalClaimed = claimable();
        lastValuePerAddress[msg.sender] = lastValue;
        if (totalClaimed > 0) {
            IMintable(rewardToken).mint(msg.sender, totalClaimed);
            emit Claim(msg.sender, totalClaimed);
        }
    }

    function _currentPeriod() private view returns (uint256) {
        return deltaPeriod + (block.timestamp - startPool) / coolDown;
    }

    function setDao(address _dao) external onlyOwner {
        dao = _dao;
    }

    function setCooldown(uint256 _coolDown) external onlyDao {
        deltaPeriod = deltaPeriod + (block.timestamp - startPool) / coolDown;
        startPool = block.timestamp;
        coolDown = _coolDown;
    }

    function setRoot(bytes32 _root) external onlyDao {
        merkleRoot = _root; 
    }
}