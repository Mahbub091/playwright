/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { StackFrame } from '@protocol/channels';
import type { ActionTraceEvent } from '@trace/trace';
import { SplitView } from '@web/components/splitView';
import * as React from 'react';
import { useAsyncMemo } from './helpers';
import './sourceTab.css';
import { StackTraceView } from './stackTrace';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';

type StackInfo = {
  frames: StackFrame[];
  fileContent: Map<string, string>;
};

export const SourceTab: React.FunctionComponent<{
  action: ActionTraceEvent | undefined,
  hideStackFrames?: boolean,
}> = ({ action, hideStackFrames }) => {
  const [lastAction, setLastAction] = React.useState<ActionTraceEvent | undefined>();
  const [selectedFrame, setSelectedFrame] = React.useState<number>(0);

  React.useEffect(() => {
    if (lastAction !== action) {
      setLastAction(action);
      setSelectedFrame(0);
    }
  }, [action, lastAction, setLastAction, setSelectedFrame]);

  const stackInfo = React.useMemo<StackInfo>(() => {
    if (!action)
      return { frames: [], fileContent: new Map() };
    const frames = action.stack || [];
    return {
      frames,
      fileContent: new Map(),
    };
  }, [action]);

  const content = useAsyncMemo<string>(async () => {
    const filePath = stackInfo.frames[selectedFrame]?.file;
    if (!filePath)
      return '';
    if (!stackInfo.fileContent.has(filePath)) {
      const sha1 = await calculateSha1(filePath);
      try {
        let response = await fetch(`sha1/src@${sha1}.txt`);
        if (response.status === 404)
          response = await fetch(`file?path=${filePath}`);
        stackInfo.fileContent.set(filePath, await response.text());
      } catch {
        stackInfo.fileContent.set(filePath, `<Unable to read "${filePath}">`);
      }
    }
    return stackInfo.fileContent.get(filePath)!;
  }, [stackInfo, selectedFrame], '');

  const targetLine = stackInfo.frames[selectedFrame]?.line || 0;
  const error = action?.error?.message;
  return <SplitView sidebarSize={200} orientation='horizontal' sidebarHidden={hideStackFrames}>
    <CodeMirrorWrapper text={content} language='javascript' highlight={[{ line: targetLine, type: error ? 'error' : 'running', message: error }]} revealLine={targetLine} readOnly={true} lineNumbers={true}></CodeMirrorWrapper>
    <StackTraceView action={action} selectedFrame={selectedFrame} setSelectedFrame={setSelectedFrame}></StackTraceView>
  </SplitView>;
};

export async function calculateSha1(text: string): Promise<string> {
  const buffer = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-1', buffer);
  const hexCodes = [];
  const view = new DataView(hash);
  for (let i = 0; i < view.byteLength; i += 1) {
    const byte = view.getUint8(i).toString(16).padStart(2, '0');
    hexCodes.push(byte);
  }
  return hexCodes.join('');
}
