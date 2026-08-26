export function Emoji({ char }: { char: string }) {
  return (
    <span aria-hidden="true" className="select-none">
      {char}{" "}
    </span>
  );
}
