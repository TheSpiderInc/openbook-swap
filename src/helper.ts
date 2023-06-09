export const waitFor = async (time: number): Promise<void> => {
    await new Promise(async (res, rej) => {
        setTimeout(() => {
            res(null);
        }, time);
    })
}