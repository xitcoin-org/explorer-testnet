import { fromBase64, toBase64 } from '@cosmjs/encoding';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { MsgDelegate } from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { AuthInfo, TxBody, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { XITCOIN } from './xitcoinTransaction';

export const XITCOIN_PUBLIC_KEY_TYPE =
  '/cosmos.evm.crypto.v1.ethsecp256k1.PubKey';
interface SignDoc {
  bodyBytes: Uint8Array;
  authInfoBytes: Uint8Array;
  chainId: string;
  accountNumber: bigint;
}
interface DirectSigner {
  getAccounts(): Promise<readonly { address: string; pubkey: Uint8Array }[]>;
  signDirect(
    address: string,
    doc: SignDoc
  ): Promise<{ signed: SignDoc; signature: { signature: string } }>;
}
export interface DialogProvider {
  enable(chainId: string): Promise<void>;
  getOfflineSigner(chainId: string): DirectSigner;
}
type Message = { typeUrl: string; value: any };

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      'Xitcoin API is unavailable or rejected the request. Please retry.'
    );
  try {
    return await response.json();
  } catch {
    throw new Error('Malformed Xitcoin response.');
  }
}
function equal(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/** Explicit Cosmos EVM key encoding; the generic Stargate signer uses a different public key type. */
export class XitcoinSigningClient {
  private constructor(
    private signer: DirectSigner,
    private sender: string,
    private pubkey: Uint8Array
  ) {}

  static async connect(provider: DialogProvider, sender: string) {
    await provider.enable(XITCOIN.chainId);
    const signer = provider.getOfflineSigner(XITCOIN.chainId);
    const account = (await signer.getAccounts()).find(
      (account) => account.address === sender
    );
    if (
      !account ||
      account.pubkey?.length !== 33 ||
      ![2, 3].includes(account.pubkey[0])
    ) {
      throw new Error(
        'Wallet account changed or returned an invalid public key. Reconnect your Xitcoin wallet.'
      );
    }
    const status = await request(`${XITCOIN.rpc}/status`);
    if (status?.result?.node_info?.network !== XITCOIN.chainId)
      throw new Error('Unexpected RPC chain. Transactions are disabled.');
    return new XitcoinSigningClient(signer, sender, account.pubkey);
  }

  private async document(
    messages: readonly Message[],
    memo: string,
    gas: string,
    amount: string
  ): Promise<SignDoc> {
    const response = await request(
      `${XITCOIN.rest}/cosmos/auth/v1beta1/accounts/${this.sender}`
    );
    const account = response?.account;
    if (
      account?.['@type'] !== '/cosmos.auth.v1beta1.BaseAccount' ||
      account.address !== this.sender ||
      typeof account.account_number !== 'string' ||
      typeof account.sequence !== 'string' ||
      !/^\d{1,20}$/.test(account.account_number) ||
      !/^\d{1,20}$/.test(account.sequence) ||
      BigInt(account.account_number) > 18446744073709551615n ||
      BigInt(account.sequence) > 18446744073709551615n
    )
      throw new Error('Malformed Xitcoin account data.');
    if (
      account.pub_key &&
      (account.pub_key['@type'] !== XITCOIN_PUBLIC_KEY_TYPE ||
        account.pub_key.key !== toBase64(this.pubkey))
    ) {
      throw new Error('Wallet public key does not match the Xitcoin account.');
    }
    const bodyBytes = TxBody.encode(
      TxBody.fromPartial({
        memo,
        messages: messages.map((message) => {
          if (message.typeUrl === '/cosmos.bank.v1beta1.MsgSend')
            return {
              typeUrl: message.typeUrl,
              value: MsgSend.encode(
                MsgSend.fromPartial(message.value)
              ).finish(),
            };
          if (message.typeUrl === '/cosmos.staking.v1beta1.MsgDelegate')
            return {
              typeUrl: message.typeUrl,
              value: MsgDelegate.encode(
                MsgDelegate.fromPartial(message.value)
              ).finish(),
            };
          throw new Error('Unsupported Xitcoin transaction.');
        }),
      })
    ).finish();
    const authInfoBytes = AuthInfo.encode(
      AuthInfo.fromPartial({
        signerInfos: [
          {
            publicKey: {
              typeUrl: XITCOIN_PUBLIC_KEY_TYPE,
              value: PubKey.encode({ key: this.pubkey }).finish(),
            },
            sequence: BigInt(account.sequence),
            modeInfo: { single: { mode: 1 } },
          },
        ],
        fee: {
          gasLimit: BigInt(gas),
          amount: [{ denom: XITCOIN.coinMinimalDenom, amount }],
        },
      })
    ).finish();
    return {
      bodyBytes,
      authInfoBytes,
      chainId: XITCOIN.chainId,
      accountNumber: BigInt(account.account_number),
    };
  }

  async simulate(messages: readonly Message[], memo: string): Promise<number> {
    const doc = await this.document(messages, memo, '0', '0');
    const txBytes = TxRaw.encode({
      bodyBytes: doc.bodyBytes,
      authInfoBytes: doc.authInfoBytes,
      signatures: [new Uint8Array()],
    }).finish();
    const response = await request(
      `${XITCOIN.rest}/cosmos/tx/v1beta1/simulate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_bytes: toBase64(txBytes) }),
      }
    );
    const gas = response?.gas_info?.gas_used;
    if (
      typeof gas !== 'string' ||
      !/^\d+$/.test(gas) ||
      !Number.isSafeInteger(Number(gas)) ||
      Number(gas) > Number.MAX_SAFE_INTEGER / 15 ||
      Number(gas) <= 0
    )
      throw new Error('Malformed simulation result.');
    return Number(gas);
  }

  async signAndBroadcast(
    messages: readonly Message[],
    memo: string,
    gas: string,
    fee: string,
    isCurrent: () => boolean
  ) {
    const doc = await this.document(messages, memo, gas, fee);
    if (!isCurrent()) throw new Error('Wallet changed. Please retry.');
    const result = await this.signer.signDirect(this.sender, {
      ...doc,
      bodyBytes: new Uint8Array(doc.bodyBytes),
      authInfoBytes: new Uint8Array(doc.authInfoBytes),
    });
    if (!isCurrent())
      throw new Error('Wallet changed. Transaction was not broadcast.');
    if (
      result.signed.chainId !== doc.chainId ||
      BigInt(result.signed.accountNumber) !== doc.accountNumber ||
      !equal(result.signed.bodyBytes, doc.bodyBytes) ||
      !equal(result.signed.authInfoBytes, doc.authInfoBytes)
    ) {
      throw new Error(
        'Wallet changed the transaction. Review and simulate again.'
      );
    }
    const signature = fromBase64(result.signature.signature);
    if (![64, 65].includes(signature.length))
      throw new Error('Invalid wallet signature.');
    const txBytes = TxRaw.encode({
      bodyBytes: doc.bodyBytes,
      authInfoBytes: doc.authInfoBytes,
      signatures: [signature],
    }).finish();
    const response = await request(`${XITCOIN.rest}/cosmos/tx/v1beta1/txs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_bytes: toBase64(txBytes),
        mode: 'BROADCAST_MODE_SYNC',
      }),
    }).catch(() => {
      throw new Error(
        'Broadcast result unavailable. Check your account on the explorer before retrying.'
      );
    });
    const tx = response?.tx_response;
    if (tx?.code !== 0 || !/^[0-9A-Fa-f]{64}$/.test(tx?.txhash))
      throw new Error(
        'Transaction was not accepted. Check the explorer before retrying.'
      );
    return tx.txhash as string;
  }
}
