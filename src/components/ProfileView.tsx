import type { SingerProfile } from '../types';
import { NoteLines } from './ui';

export function ProfileView({ profile, only }: { profile: SingerProfile; only?: string[] }) {
  const sections = only ? profile.sections.filter((s) => only.includes(s.id)) : profile.sections;
  return (
    <div className="two">
      {sections.map((s) => (
        <div key={s.id} className="card flat" style={{ padding: 0 }}>
          <h3>{s.title}</h3>
          <div className="mt8">
            <NoteLines lines={s.items.map((i) => ({ text: i.text, evidence: i.evidence, proof: i.proof }))} />
          </div>
        </div>
      ))}
    </div>
  );
}
