import { PublicKey } from '@solana/web3.js';
import { getCloseOpenOrdersInstruction } from '../src';

describe('index', () => {
  describe('closeOpenOrders', () => {
    it('get instruction data', () => {
        const openOrders = new PublicKey('HxRELUQfvvjToVbacjr9YECdfQMUqGgPYB68jVDYxkbr');
        const market = new PublicKey('HxRELUQfvvjToVbacjr9YECdfQMUqGgPYB68jVDYxkbr');
        const owner = new PublicKey('HxRELUQfvvjToVbacjr9YECdfQMUqGgPYB68jVDYxkbr');
        const result = getCloseOpenOrdersInstruction(openOrders, market, owner);

        expect(result?.data).toBeTruthy();
    });
  });
});