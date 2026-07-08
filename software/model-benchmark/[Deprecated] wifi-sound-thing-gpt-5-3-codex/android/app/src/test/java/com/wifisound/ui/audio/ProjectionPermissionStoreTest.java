package com.wifisound.ui.audio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Intent;

import org.junit.Test;

public class ProjectionPermissionStoreTest {
    @Test
    public void permissionStore_setAndRead() {
        Intent data = new Intent("test-action");
        ProjectionPermissionStore.set(123, data);

        assertTrue(ProjectionPermissionStore.hasPermission());
        assertEquals(123, ProjectionPermissionStore.getResultCode());
        assertNotNull(ProjectionPermissionStore.getDataIntent());
    }

    @Test
    public void permissionStore_overwriteClearsWhenNullIntent() {
        ProjectionPermissionStore.set(321, null);
        assertFalse(ProjectionPermissionStore.hasPermission());
    }
}
