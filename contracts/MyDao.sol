//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interfaces/IStake.sol";
import "./interfaces/IMintable.sol";

contract MyDao {
    uint256 public immutable minimumQuorum;
    uint256 public immutable duration;
    address public immutable chairman;
    address public immutable stake;
    Proposal[] public proposals;
    mapping(uint256 => mapping(address => bool)) public voted;
    mapping(address => uint256) public endVote;

    event ProposalCreated(uint256 indexed proposalId, uint256 endTime);
    event Voted(uint256 indexed proposalId, address indexed voter, bool value);
    event ProposalFinished(uint256 indexed proposalId, bool result);

    struct Proposal {
        uint256 startTime;
        uint256 votesYes;
        uint256 votesNo;
        address recipient;
        bool finished;
        bytes callData;
        string description;
    }

    modifier onlyChairman() {
        require(msg.sender == chairman, "Only chairman allowed");
        _;
    }

    constructor(
        address _chairman,
        address _stake,
        uint256 _minimumQuorum,
        uint256 _duration
    ) {
        chairman = _chairman;
        stake = _stake;
        minimumQuorum = _minimumQuorum;
        duration = _duration;
    }

    function addProposal(
        bytes calldata _callData,
        address _recipient,
        string calldata _description
    ) external onlyChairman returns (uint256 _proposalId) {
        Proposal memory proposal = Proposal({
            description: _description,
            recipient: _recipient,
            callData: _callData,
            startTime: block.timestamp,
            votesYes: 0,
            votesNo: 0,
            finished: false
        });
        proposals.push(proposal);
        emit ProposalCreated(_proposalId, proposal.startTime + duration);
        return proposals.length - 1;
    }

    function vote(uint256 _proposalIndex, bool _answer) external {
        require(_proposalIndex < proposals.length, "Invalid proposal index");
        require(msg.sender != chairman, "Chairman cannot vote");
        Proposal storage proposal = proposals[_proposalIndex];
        require(!voted[_proposalIndex][msg.sender], "You have already voted");
        require(
            block.timestamp < proposal.startTime + duration,
            "Voting period has ended"
        );
        if (_answer) {
            proposal.votesYes += IStake(stake).balanceOf(msg.sender);
        } else {
            proposal.votesNo +=  IStake(stake).balanceOf(msg.sender);
        }
        voted[_proposalIndex][msg.sender] = true;
        if (endVote[msg.sender] < proposal.startTime + duration){
            endVote[msg.sender] = proposal.startTime + duration;
        }
        emit Voted(_proposalIndex, msg.sender, _answer);
    }

    function finishProposal(uint256 _proposalIndex) external {
        require(_proposalIndex < proposals.length, "Invalid proposal index");
        Proposal memory proposal = proposals[_proposalIndex];
        require(!proposal.finished, "Proposal has already finished");
        require(
            block.timestamp >= proposal.startTime + duration,
            "Voting period has not yet ended"
        );
        proposals[_proposalIndex].finished = true;
        bool result = proposal.votesYes > proposal.votesNo &&
            proposal.votesYes + proposal.votesNo >= minimumQuorum;
        if (result) {
            (bool success, bytes memory data) = proposal.recipient.call{value: 0}(
                proposal.callData
            );
            require(success, string (data));
        }
        emit ProposalFinished(_proposalIndex, result);
    }

    function lastVotingEndTime(address) external view returns (uint256) {
        return endVote[msg.sender];
    }
}
