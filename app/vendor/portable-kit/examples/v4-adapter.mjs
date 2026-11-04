/**
 * Application-side adapter example. Supply actual imported app contracts.
 * No checkout path, dynamic import, storage operation or network dependency here.
 */
export function makeV4Validator({ savedWorkContract, workReferenceErrors, knownSourceIds }) {
  if (typeof savedWorkContract?.safeParse !== 'function' || typeof workReferenceErrors !== 'function' || !Array.isArray(knownSourceIds)) {
    throw new TypeError('Provide the actual savedWorkContract, reference validator, and known source IDs.');
  }
  const sourceIds = [...knownSourceIds];
  return work => {
    const result = savedWorkContract.safeParse(work);
    if (!result.success) return result;
    if (workReferenceErrors(result.data, sourceIds).length) return { success: false };
    return result;
  };
}
