import { registerFollowUpPatientTabModule } from './modules/moduleTabFollowUp';
import { registerMtbPatientTabModule } from './modules/moduleTabMtb';
import { registerClinicalTrialsGovPatientTabModule } from './modules/moduleTabClinicalTrialsGov';
import { registerPromsPatientTabModule } from './modules/moduleTabProms';

let initialized = false;

export function initializeCustomModules() {
    if (initialized) {
        return;
    }

    initialized = true;

    registerMtbPatientTabModule();
    registerFollowUpPatientTabModule();
    registerClinicalTrialsGovPatientTabModule();
    registerPromsPatientTabModule();
}

export function resetCustomModulesForTest() {
    initialized = false;
}
