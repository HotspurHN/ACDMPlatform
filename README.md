Rinkeby contract example: https://rinkeby.etherscan.io/address/0x7E345Ac788943f65fd83cF47B812139e2758B2d8
https://rinkeby.etherscan.io/address/0xf24Aa8d6F8a86472A1e0F1934A223BE00586F1B5

Tasks:
```
npx hardhat transfer --to 0xd88647bB0Eb39FF7bAaE7FEC1Bb75332A385dF6A --value 950000000000000000 --network rinkeby
npx hardhat approve --spender 0xd88647bB0Eb39FF7bAaE7FEC1Bb75332A385dF6A --value 50000000000000000 --network rinkeby
npx hardhat transferfrom --from 0x3C96E5Cfc585847aE330fa1A7f35647744d85F1D --to 0x3C96E5Cfc585847aE330fa1A7f35647744d85F1D --value 50000000000000000 --network rinkeby 
npx hardhat addproposalmint --network rinkeby --to 0x3C96E5Cfc585847aE330fa1A7f35647744d85F1D 
```

`.env` constants
```
PRIVATE_KEY=""
ALCHEMY_API_KEY=""
CONTRACT=""
ETHERSCAN=""
```

deploy 
`npx hardhat run --network rinkeby scripts/deploy.ts`
`npx hardhat verify --network rinkeby --constructor-args arguments.js 0xf122f67A14172bC0Aead80599FA80e08f750eaf1`