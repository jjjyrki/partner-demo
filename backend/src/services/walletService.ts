import { Transaction } from 'sequelize';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../db/models');

export async function lockFunds(
  userId: number,
  amount: number,
  transaction: Transaction
): Promise<void> {
  const wallet = await db.Wallet.findOne({
    where: { user_id: userId },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });
  if (!wallet) throw new Error('Wallet not found');
  if (wallet.available_balance < amount) {
    throw new Error('Insufficient available balance');
  }
  await wallet.update(
    {
      available_balance: wallet.available_balance - amount,
      locked_balance: wallet.locked_balance + amount,
    },
    { transaction }
  );
}

export async function unlockFunds(
  userId: number,
  amount: number,
  transaction: Transaction
): Promise<void> {
  const wallet = await db.Wallet.findOne({
    where: { user_id: userId },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });
  if (!wallet) throw new Error('Wallet not found');
  if (wallet.locked_balance < amount) {
    throw new Error('Insufficient locked balance');
  }
  await wallet.update(
    {
      available_balance: wallet.available_balance + amount,
      locked_balance: wallet.locked_balance - amount,
    },
    { transaction }
  );
}

export async function transferPayout(
  fromUserId: number,
  toUserId: number,
  amount: number,
  transaction: Transaction
): Promise<void> {
  const [fromWallet, toWallet] = await Promise.all([
    db.Wallet.findOne({
      where: { user_id: fromUserId },
      lock: transaction.LOCK.UPDATE,
      transaction,
    }),
    db.Wallet.findOne({
      where: { user_id: toUserId },
      lock: transaction.LOCK.UPDATE,
      transaction,
    }),
  ]);
  if (!fromWallet || !toWallet) throw new Error('Wallet not found');
  if (fromWallet.locked_balance < amount) {
    throw new Error('Insufficient locked balance for payout');
  }
  await fromWallet.update(
    {
      locked_balance: fromWallet.locked_balance - amount,
    },
    { transaction }
  );
  await toWallet.update(
    {
      available_balance: toWallet.available_balance + amount,
    },
    { transaction }
  );
}
