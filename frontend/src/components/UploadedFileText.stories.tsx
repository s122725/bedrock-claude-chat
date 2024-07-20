import { useState } from 'react';
import UploadedFileText from './UploadedFileText';
import ButtonIcon from './ButtonIcon';
import { PiX } from 'react-icons/pi';

export const ChatMessage = () => {
  const files = ['UploadFile1.txt', 'UploadFile2.txt'];
  return (
    <div key="files" className="my-2 flex">
      {files.map((file, idx) => {
        return (
          <UploadedFileText
            key={idx}
            fileName={file}
            onClick={() => {}}
          />
        );
      })}
    </div>
  );
};

export const InputChatContent = () => {
  const [files, setFiles] = useState(['UploadFile1.txt', 'UploadFile2.txt']);
  return (
    <div className="relative m-2 mr-24 flex flex-wrap gap-3">
      {files.map((file, idx) => {
        return (
          <div key={idx} className="relative flex flex-col items-center">
            <UploadedFileText
              fileName={file}
              onClick={() => {}}
            />
            <ButtonIcon
              className="absolute left-2 top-1 -m-2 border border-aws-sea-blue bg-white p-1 text-xs text-aws-sea-blue"
              onClick={() => {
                setFiles(files.filter(value => value !== file));
              }}>
              <PiX />
            </ButtonIcon>
          </div>
        );
      })}
    </div>
  );
};
