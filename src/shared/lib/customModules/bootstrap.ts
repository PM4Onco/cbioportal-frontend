import { registerFollowUpPatientTabModule } from './modules/moduleTabFollowUp';
import { registerMtbPatientTabModule } from './modules/moduleTabMtb';
import { registerClinicalTrialsGovPatientTabModule } from './modules/moduleTabClinicalTrialsGov';

let initialized = false;

export function initializeCustomModules() {
    if (initialized) {
        return;
    }

    initialized = true;

    registerMtbPatientTabModule();
    registerFollowUpPatientTabModule();
    registerClinicalTrialsGovPatientTabModule();
}

export function resetCustomModulesForTest() {
    initialized = false;
}
