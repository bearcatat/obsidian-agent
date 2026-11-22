/** Apply an in-memory model change only for as long as its durable save succeeds. */
export async function persistModelTransaction<T>(apply: () => void, rollback: () => void, save: () => Promise<T>): Promise<T> {
  apply();
  try {
    return await save();
  } catch (error) {
    rollback();
    throw error;
  }
}
