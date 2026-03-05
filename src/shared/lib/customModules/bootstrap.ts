let initialized = false;

export function initializeCustomModules() {
    if (initialized) {
        return;
    }

    initialized = true;
}

export function resetCustomModulesForTest() {
    initialized = false;
}
