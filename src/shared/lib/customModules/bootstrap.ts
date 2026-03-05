import { registerFollowUpPatientTabModule } from './modules/moduleTabFollowUp';
import { registerMtbPatientTabModule } from './modules/moduleTabMtb';

let initialized = false;

export function initializeCustomModules() {
    if (initialized) {
        return;
    }

    initialized = true;

    registerMtbPatientTabModule();
    registerFollowUpPatientTabModule();
}

export function resetCustomModulesForTest() {
    initialized = false;
}
