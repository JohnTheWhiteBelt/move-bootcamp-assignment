// Copyright © Aptos Foundation
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable no-console */

import dotenv from "dotenv";
dotenv.config();

import { AptosAccount, FaucetClient, AptosToken, CoinClient, Network, Provider, HexString } from "aptos";
import { NODE_URL, FAUCET_URL, RECEIVER } from "./common";

(async () => {
  // Create API and faucet clients.
  // :!:>section_1a
  const provider = new Provider(Network.DEVNET);
  const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL); // <:!:section_1a

  // Create client for working with the token module.
  // :!:>section_1b
  const aptosTokenClient = new AptosToken(provider); // <:!:section_1b

  // Create a coin client for checking account balances.
  const coinClient = new CoinClient(provider.aptosClient);

  // Create accounts.
  // :!:>section_2
  const encodeClub = new AptosAccount();

  // Print out account addresses.
  console.log("=== Addresses ===");
  console.log(`Encode Club: ${encodeClub.address()}`);

  // Fund accounts.
  // :!:>section_3
  await faucetClient.fundAccount(encodeClub.address(), 100_000_000);

  console.log("=== Initial Coin Balances ===");
  console.log(`Encode Club: ${await coinClient.checkBalance(encodeClub)}`);

  console.log("=== Creating Collection and Token ===");

  const collectionName = "Encode Certificate";
  const tokenName = "Encode Club's Move Bootcamp Graduate";
  const maxSupply = 30;

  // Create the collection.
  // :!:>section_4
  const txnHash1 = await aptosTokenClient.createCollection(
    encodeClub,
    "Certificate for Encode Club's programmes",
    collectionName,
    "https://cdn-images-1.medium.com/v2/resize:fit:1200/1*DFfvSxnNzc5qLgDsLLXrbw.jpeg",
    maxSupply,
    {
      royaltyNumerator: 5,
      royaltyDenominator: 100,
    },
  ); // <:!:section_4
  await provider.aptosClient.waitForTransaction(txnHash1, { checkSuccess: true });

  // Create a token in that collection.
  // :!:>section_5
  const txnHash2 = await aptosTokenClient.mint(
    encodeClub,
    collectionName,
    "Certificate for Encode Club's Move Bootcamp Graduate",
    tokenName,
    "https://images.squarespace-cdn.com/content/5f9bcc27c14fc6134658484b/1692268624709-UWMJ9IPVTJ1J358KQ509/Bootcamp_Move_main_banner.jpeg?format=1500w&content-type=image%2Fjpeg",
    [],
    [],
    [],
  ); // <:!:section_5
  await provider.aptosClient.waitForTransaction(txnHash2, { checkSuccess: true });

  const inSync = await ensureIndexerAndNetworkInSync(provider);
  if (!inSync) {
    return;
  }

  // Print the collection data.
  // :!:>section_6
  const collectionData = (await provider.getCollectionData(encodeClub.address(), collectionName)).current_collections_v2[0];
  console.log(`Encode Club's collection: ${JSON.stringify(collectionData, null, 4)}`); // <:!:section_6

  // Get the token balance.
  // :!:>section_7
  const collectionAddress = HexString.ensure(collectionData.collection_id);
  let { tokenAddress, amount: encodeClubAmount } = await getTokenInfo(provider, encodeClub.address(), collectionAddress);
  console.log(`Encode Club's token balance: ${encodeClubAmount}`); // <:!:section_7

  // Get the token data.
  // :!:>section_8
  const tokenData = (await provider.getTokenData(tokenAddress.toString())).current_token_datas_v2[0];
  console.log(`Encode Club's token data: ${JSON.stringify(tokenData, null, 4)}`); // <:!:section_8

  // Encode Club transfers the token to .
  const student = new HexString(RECEIVER);
  console.log("\n=== Transferring the token to Student ===");
  // :!:>section_9
  const txnHash3 = await aptosTokenClient.transferTokenOwnership(encodeClub, tokenAddress, student); // <:!:section_9
  await provider.aptosClient.waitForTransaction(txnHash3, { checkSuccess: true });

  // Print their balances.
  // :!:>section_10
  encodeClubAmount = (await getTokenInfo(provider, encodeClub.address(), collectionAddress)).amount;
  let studentAmount = (await getTokenInfo(provider, student, collectionAddress)).amount;
  console.log(`Encode Club's token balance: ${encodeClubAmount}`);
  console.log(`Student's token balance: ${studentAmount}`); // <:!:section_10


  console.log("\n=== Getting Encode Clubs's NFTs ===");
  console.log(
    `Encode Club current token ownership: ${
      (await getTokenInfo(provider, encodeClub.address(), collectionAddress)).amount
    }. Should be 0`,
  );

  console.log("\n=== Getting Student's NFTs ===");
  console.log(
    `Student current token ownership: ${
      (await getTokenInfo(provider, student, collectionAddress)).amount
    }. Should be 1\n`,
  );
})();

// :!:>getTokenInfo
async function getTokenInfo(
  provider: Provider,
  ownerAddress: HexString,
  collectionAddress: HexString,
): Promise<{ tokenAddress?: HexString; amount: number }> {
  const tokensOwnedQuery = await provider.getTokenOwnedFromCollectionAddress(
    ownerAddress,
    collectionAddress.toString(),
    {
      tokenStandard: "v2",
    },
  );
  const tokensOwned = tokensOwnedQuery.current_token_ownerships_v2.length;
  if (tokensOwned > 0) {
    return {
      tokenAddress: HexString.ensure(tokensOwnedQuery.current_token_ownerships_v2[0].current_token_data.token_data_id),
      amount: tokensOwnedQuery.current_token_ownerships_v2[0].amount,
    };
  } else {
    return {
      tokenAddress: undefined,
      amount: tokensOwned,
    };
  }
} // <:!:getTokenInfo

async function ensureIndexerAndNetworkInSync(provider: Provider): Promise<boolean> {
  const indexerLedgerInfo = await provider.getIndexerLedgerInfo();
  const fullNodeChainId = await provider.getChainId();
  if (indexerLedgerInfo.ledger_infos[0].chain_id !== fullNodeChainId) {
    console.log(`\nERROR: Provider's fullnode chain id and indexer chain id are not synced, skipping rest of tests`);
    return false;
  } else {
    return true;
  }
}
