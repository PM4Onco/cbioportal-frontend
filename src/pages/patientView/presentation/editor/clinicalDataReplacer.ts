import { Extension, textInputRule } from '@tiptap/core';

interface ClinicalData {
    clinicalAttributeId: string;
    clinicalAttribute: { displayName: string };
    value: string;
}

const asRegexVariable = (id: string, displayName: string) => {
    return new RegExp(String.raw`{{${id}}}|{{${displayName}}}$`, 'i');
};

export const ClinicalDataReplacer = Extension.create({
    name: 'clinicalDataReplacer',
    addInputRules() {
        const clinicalData: ClinicalData[] = this.options.clinicalData;

        return (
            clinicalData?.map(entry => {
                return textInputRule({
                    find: asRegexVariable(
                        escapeRegExp(entry.clinicalAttributeId),
                        escapeRegExp(entry.clinicalAttribute.displayName)
                    ),
                    replace: entry.value,
                });
            }) ?? []
        );
    },
});

// Should be replaced with RegExp.escape as soon as it is widely available
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/escape
function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
