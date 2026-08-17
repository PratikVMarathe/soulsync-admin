import { useState } from 'react';
import { useAppNotice } from './useAppNotice';
import {
  blockUser,
  unblockUser,
  updateUserName,
  updateUserPhone,
} from '../services/userManagementService';

/**
 * Hook for user management mutation actions.
 * Uses AppNoticeCenter for success/error feedback (same as the rest of the admin shell).
 *
 * Returns action functions and loading state.
 * onSuccess callback is invoked with the action type so callers can refresh data.
 */
export function useUserManagementActions(viewer, { onSuccess } = {}) {
  const { showNotice } = useAppNotice();
  const [actionState, setActionState] = useState({});

  function startAction(key) {
    setActionState((s) => ({ ...s, [key]: true }));
  }

  function endAction(key) {
    setActionState((s) => ({ ...s, [key]: false }));
  }

  async function handleUpdateName({ uid, name }) {
    startAction('updateName');

    try {
      await updateUserName({ uid, name, viewer });
      showNotice('User name updated successfully.', 'success');
      onSuccess?.('updateName', { uid });
    } catch (err) {
      showNotice(err?.publicMessage || 'Could not update name. Please try again.', 'error');
      throw err;
    } finally {
      endAction('updateName');
    }
  }

  async function handleUpdatePhone({ uid, phoneNumber }) {
    startAction('updatePhone');

    try {
      await updateUserPhone({ uid, phoneNumber, viewer });
      showNotice('Phone number updated successfully.', 'success');
      onSuccess?.('updatePhone', { uid });
    } catch (err) {
      showNotice(err?.publicMessage || 'Could not update phone number. Please try again.', 'error');
      throw err;
    } finally {
      endAction('updatePhone');
    }
  }

  async function handleBlockUser({ uid }) {
    startAction('blockUser');

    try {
      await blockUser({ uid, viewer });
      showNotice('User has been blocked.', 'success');
      onSuccess?.('blockUser', { uid });
    } catch (err) {
      showNotice(err?.publicMessage || 'Could not block user. Please try again.', 'error');
      throw err;
    } finally {
      endAction('blockUser');
    }
  }

  async function handleUnblockUser({ uid }) {
    startAction('unblockUser');

    try {
      await unblockUser({ uid, viewer });
      showNotice('User has been unblocked.', 'success');
      onSuccess?.('unblockUser', { uid });
    } catch (err) {
      showNotice(err?.publicMessage || 'Could not unblock user. Please try again.', 'error');
      throw err;
    } finally {
      endAction('unblockUser');
    }
  }

  return {
    actionState,
    handleUpdateName,
    handleUpdatePhone,
    handleBlockUser,
    handleUnblockUser,
    isUpdatingName: Boolean(actionState.updateName),
    isUpdatingPhone: Boolean(actionState.updatePhone),
    isBlocking: Boolean(actionState.blockUser),
    isUnblocking: Boolean(actionState.unblockUser),
  };
}
