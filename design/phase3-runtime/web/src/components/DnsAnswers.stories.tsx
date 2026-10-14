import type { Meta, StoryObj } from '@storybook/react';
import { DnsAnswers } from './DnsAnswers';
import { phase3Dns } from '../lib/phase3Demo';

const meta: Meta<typeof DnsAnswers> = { title: 'Components/DnsAnswers', component: DnsAnswers };
export default meta;

export const RecordsWithTtl: StoryObj<typeof DnsAnswers> = {
  args: { record: phase3Dns[0]! },
};

export const LegacyCountOnly: StoryObj<typeof DnsAnswers> = {
  args: { record: { id: 'dns-legacy', query_name: 'legacy.example', query_type: 'A', rcode: 'NOERROR', answers: 2 } },
};

export const Unrecorded: StoryObj<typeof DnsAnswers> = {
  args: { record: phase3Dns.find(d => d.id === 'dns-04')! },
};

/** Typed records where the producer kept only part of the answer set. */
export const OmittedTypedRecords: StoryObj<typeof DnsAnswers> = {
  args: { record: { id: 'dns-omitted', query: 'multi.example', type: 'A', result: 'NOERROR', answers: ['198.51.100.70'], answer_count: 4, answers_omitted: true, answer_records: [{ name: 'multi.example', type: 'A', value: '198.51.100.70', ttl: 120 }] } },
};

/** Bare answer values still carry the omitted warning — never silently partial. */
export const OmittedBareValues: StoryObj<typeof DnsAnswers> = {
  args: { record: { id: 'dns-omitted-bare', query: 'multi.example', type: 'A', result: 'NOERROR', answers: ['198.51.100.70', '198.51.100.71'], answer_count: 5, answers_omitted: true } },
};

/** An unobserved response: answers are unknown, never zero. */
export const UnobservedResponse: StoryObj<typeof DnsAnswers> = {
  args: { record: { id: 'dns-unobserved', query: 'missed.example', type: 'A', result: 'UNOBSERVED_RESPONSE' } },
};
