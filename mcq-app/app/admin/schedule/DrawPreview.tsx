import type { PreviewGroup } from "./scheduleModel";

export function DrawPreview({ groups }: { groups: PreviewGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.subject} className="space-y-3">
          <h2 className="text-lg">{group.subject}</h2>
          {group.topics.map((topic) => (
            <div key={topic.name} className="space-y-2">
              <h3 className="text-base">{topic.name}</h3>
              <ol className="list-decimal space-y-2 pl-5 text-base text-foreground">
                {topic.questions.map((question, index) => (
                  <li key={`${topic.name}-${index}`}>{question}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
