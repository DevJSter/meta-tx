export interface UserIdentity {
  aadhaarNumber: string;
  email: string;
  phoneNumber: string;
  name: string;
}

export interface WalletData {
  aadhaarNumber: string;
  email: string;
  phoneNumber: string;
  name: string;
  privateKey: string;
  publicKey: string;
  walletAddress: string;
  signatureHash: string;
  timestamp: number;
}

export interface WalletResponse {
  aadhaarNumber: string;
  email: string;
  phoneNumber: string;
  name: string;
  privateKey: string;
  publicKey: string;
  walletAddress: string;
  signatureHash: string;
  timestamp: number;
}

export interface SignatureResult {
  signature: string;
  messageHash: string;
  walletAddress: string;
  timestamp: number;
}

export interface CreateWalletRequest {
  aadhaarNumber: string;
}

export interface GetWalletRequest {
  aadhaarNumber: string;
}
