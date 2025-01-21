import { Extension, textInputRule } from '@tiptap/core';

interface ClinicalData {
    clinicalAttributeId: string;
    clinicalAttribute: { displayName: string };
    value: string;
}

const asRegexVariable = (id: string, displayName: string) => {
    return new RegExp(String.raw`{{${id}}}|{{${displayName}}}$`);
};

export const ClinicalDataReplacer = Extension.create({
    name: 'clinicalDataReplacer',
    addInputRules() {
        const clinicalData: ClinicalData[] = this.options.clinicalData;

        return clinicalData.map(entry =>
            textInputRule({
                find: asRegexVariable(
                    entry.clinicalAttributeId,
                    entry.clinicalAttribute.displayName
                ),
                replace: entry.value,
            })
        );
    },
});
