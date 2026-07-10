import { createPublicKey } from "node:crypto";
import { V4 } from "paseto";

const privateKey = await V4.generateKey("public");
const publicKey = createPublicKey(privateKey);

const privateBytes = V4.keyObjectToBytes(privateKey);
const publicBytes = V4.keyObjectToBytes(publicKey);

console.log(`PASETO_PRIVATE_KEY=${privateBytes.toString("base64")}`);
console.log(`PASETO_PUBLIC_KEY=${publicBytes.toString("base64")}`);
