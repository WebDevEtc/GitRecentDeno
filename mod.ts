import { exec, OutputMode } from "https://deno.land/x/exec/mod.ts";

interface RecentBranchChange  {
  fromBranch: string,
  when: string
}

async function getRecentBranches(): Promise<RecentBranchChange[]> {
  const reflogs = await (await exec("git reflog show --pretty=format:'%gs~~~%gd' --date=relative ", { output: OutputMode.Capture })).output.split("\n")
  const checkouts = reflogs.filter(reflog => reflog.includes('checkout:'));

  return checkouts.map(checkout => checkout.split('~~~'))
    .map(([fromBranch, when]) => {
      const parsedFrom = [...fromBranch.matchAll(/checkout: moving from ([^\s]+) to (.*)/g)];
      return { fromBranch: parsedFrom[0][2], when: when.slice('HEAD@{'.length, when.length - 2) }
    });
}

function outputRecentBranchList(recents: RecentBranchChange[], line: number = 1) {
  const textEncoder = new TextEncoder();
  const maxFrom = recents.reduce((acc, cur) => Math.max(acc, cur.fromBranch.length), 0)
  const maxIndexLength = String(recents.length).length;

  for (let i = 0; i < 20; i++) {
    Deno.stdout.writeSync(textEncoder.encode(` \n`))
  }

  recents.forEach((recent, index) => {
    const repeat = Math.max(0, maxIndexLength - `${index + 1}`.length) + 4;
    Deno.stdout.writeSync(textEncoder.encode(index + 1 === line ? `👉` : ' #'))
    Deno.stdout.writeSync(textEncoder.encode(`${index + 1}`))
    Deno.stdout.writeSync(textEncoder.encode(' '.repeat(repeat)))
    Deno.stdout.writeSync(textEncoder.encode(recent.fromBranch))
    Deno.stdout.writeSync(textEncoder.encode(' '.repeat(maxFrom - recent.fromBranch.length)))
    Deno.stdout.writeSync(textEncoder.encode(' '.repeat(15)))
    Deno.stdout.writeSync(textEncoder.encode(recent.when))
    Deno.stdout.writeSync(textEncoder.encode('\n'))
  })
}

function switchBranch(recents: RecentBranchChange[], currentLine: number) {
  const switchTo = recents[(currentLine - 1) % recents.length]
  exec(`git checkout ${switchTo.fromBranch}`);
}

async function main() {
  let currentline = 0;
  const recentBranches = await getRecentBranches();
  outputRecentBranchList(recentBranches, currentline);

  while (true) {
    const buffer = new Uint8Array(1);
    Deno.setRaw(0, true);
    await Deno.stdin.read(buffer);

    const typedChar = [...buffer][0]

    if (typedChar === 66 || typedChar === 106) {
      // down arrow or j
      currentline++;
      outputRecentBranchList(recentBranches, currentline)
    }
    else if (typedChar === 65 || typedChar === 107) {
      // up arrow or k
      currentline--;
      outputRecentBranchList(recentBranches, currentline)
    }
    else if (typedChar === 13) {
      // enter
      return switchBranch(recentBranches, currentline);
    }
    else if (typedChar === 113 || typedChar === 3) {
      // q or c
      return;
    }
  }
}

main();
