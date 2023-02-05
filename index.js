import * as dotenv from "dotenv";
dotenv.config();
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const artifact = require("./artifacts/SPCredentials.json");
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import ipfsUpload from "./ipfs/uploadIpfs.js";
import ethers from "ethers";
import request from "request";
const CredentialAddress = "0x5aCBCf1F5c9D32D90a256ee42A14Cb661fbBf9A2";
var url = "https://api.hyperspace.node.glif.io/rpc/v1/";
const provider = new ethers.providers.JsonRpcProvider(url);
const app = express();
// push them above the router middleware!

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// parse application/json
app.use(express.json());
const port = process.env.PORT || 8080;
app.use(cors());

async function callRpc(method, params) {
  var options = {
    method: "POST",
    url: "https://api.hyperspace.node.glif.io/rpc/v1",
    // url: "http://localhost:1234/rpc/v0",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: method,
      params: params,
      id: 1,
    }),
  };
  const res = await request(options);
  return JSON.parse(res.body).result;
}

app.get("/", async (req, res) => {
  try {
    const response = await fetch("https://api.filrep.io/api/v1/miners", {
      method: "GET",
    });
    const minerArray = await response.json();
    res.send(minerArray.miners);
  } catch (e) {
    console.error(e);
    res.status(500);
  }
});

async function mintCredential(miner) {
  const gateway = await ipfsUpload(miner);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const nonce = await signer.getTransactionCount();
  const credentialContract = new ethers.Contract(
    CredentialAddress,
    artifact.abi,
    signer
  );
  const priorityFee = await callRpc("eth_maxPriorityFeePerGas");
  const tokenURI = gateway;
  console.log("MINTING", priorityFee);
  const txn = await credentialContract
    .connect(signer)
    .safeMint("0x6F234Fa20558743970ccEBD6AF259fCB49eeA73c",miner.address, tokenURI, {
      maxPriorityFeePerGas: priorityFee,
    }); // will f4 address work here??
  console.log(txn);
  return txn;
}

app.post("/mintCredential", async (req, res) => {
  const { minerId } = req.body;
  try {
    const response = await fetch(
      `https://api.filrep.io/api/v1/miners?limit=10&offset=0&search=${minerId}`,
      {
        method: "GET",
      }
    );
    const minerArray = await response.json();
    const ourMiner = minerArray.miners[0];
    //console.log("minor", ourMiner)
    //const ourMiner = minerArray.miners.filter((c) => c.address == minerId)
    const txn = await mintCredential(ourMiner);
    res.send(txn);
  } catch (e) {
    console.error(e);
    res.status(500);
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
