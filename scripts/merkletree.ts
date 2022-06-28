const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

export default {
    getTree: (addresses: string []) => {
        const leafNodes = addresses.map(address => keccak256(address));
        const tree = new MerkleTree(leafNodes, keccak256, {sortPairs: true});
        return {
            leafNodes,
            tree
        };
    }
}