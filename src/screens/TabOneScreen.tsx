import * as React from 'react';
import RNFS from 'react-native-fs';
import Certificate from 'react-native-certificate';
import signalr from 'react-native-signalr';
import { Button, Text, View } from 'react-native';

const hub_endpoint = 'https://cert.tilko.net';

export default function TabOneScreen() {
  const [code, setCode] = React.useState('');
  const [certs, setCert] = React.useState<any>([]);

  const readCertificates = async () => {
    const folderPath = RNFS.DocumentDirectoryPath + `/NPKI`;
    return RNFS.readDir(folderPath).then(async (result) => {
      if (result) {
        for await (const folder of result) {
          const subFolders = await RNFS.readDir(folder.path + '/USER');
          for await (const subFolder of subFolders) {
            const subFiles = await RNFS.readDir(subFolder.path);
            const isContainSigns =
              Boolean(subFiles.find((sF) => sF.name === 'signCert.der')) &&
              Boolean(subFiles.find((sF) => sF.name === 'signPri.key'));

            if (isContainSigns) {
              let result = await Certificate.getCertificate(
                subFolder.path + '/signCert.der'
              )

              if (Array.isArray(result)) {
                result = {
                  cn: result[1],
                  validDate: result[2],
                };
              }
              setCert([...certs, result]);
            }
          }
        }
      }
    }).catch(() => {});
  };

  const connectToServer = async () => {
    const publicKey = await Certificate.getPublicKey();
    const connection = signalr.hubConnection(hub_endpoint, {
      headers: {
        client_type: 'Mobile',
        public_cert: encodeURIComponent(publicKey),
      },
    });
    connection.logging = true;

    const proxy = connection.createHubProxy('AuthHub');

    proxy.on('ShowCode', (code: string) => {
      console.log('message-from-server', code);
      setCode(code);
    });

    proxy.on(
      'SaveCertificate',
      async (
        encryptedAesKey: string,
        encryptedPublicKey: string,
        encryptedPrivateKey: string,
        subjectDN: string,
        sessionId: string
      ) => {
        console.log('resresresres', encryptedAesKey)
        let res: any = await Certificate.decrypt(
          encryptedAesKey,
          encryptedPublicKey,
          encryptedPrivateKey,
          subjectDN,
          sessionId
        );
        console.log('res11111', res)
        if (Array.isArray(res)) {
          res = {
            der: res[0],
            key: res[1],
            issuedBy: res[2]
          };
        }

        const { der, key, issuedBy } = res;
        console.log('res2222', res)
        const folderPath =
          RNFS.DocumentDirectoryPath + `/NPKI/${issuedBy}/USER/` + subjectDN;

        issuedBy && (await RNFS.mkdir(folderPath));
        const derPath = folderPath + '/signCert.der';
        const keyPath = folderPath + '/signPri.key';
        await Certificate.saveCertificate(derPath, der).catch(e => console.log('derError', e));
        await Certificate.saveCertificate(keyPath, key).catch(e => console.log('keyError', e));
        await readCertificates()
      }
    );

    //connection-handling
    connection.connectionSlow(() => {
      console.log(
        'We are currently experiencing difficulties with the connection.'
      );
    });

    connection.error((error: any) => {
      const errorMessage = error.message;
      let detailedError = '';
      if (error.source && error.source._response) {
        detailedError = error.source._response;
      }
      if (
        detailedError ===
        'An SSL error has occurred and a secure connection to the server cannot be made.'
      ) {
        console.log(
          'When using react-native-signalr on ios with http remember to enable http in App Transport Security https://github.com/olofd/react-native-signalr/issues/14'
        );
      }
      console.debug('SignalR error: ' + errorMessage, detailedError);
    });

    connection
      .start()
      .done(() => {
        console.log('Now connected, connection ID=' + connection.id);
      })
      .fail(() => {
        console.log('Failed');
      });
  };

  React.useEffect(() => {
    readCertificates();
    Certificate.generateKeys();
  }, []);

  return (
    <View>
      <Text>인증서 목록</Text>
      <View>
        {certs.map((cert: any) => {
          return (
            <View key={cert.cn + cert.validDate}>
              <Text>{`${cert.cn} / ${cert.validDate}`}</Text>
            </View>
          );
        })}
      </View>
      <Button title={'인증서 가져오기'} onPress={() => connectToServer()} />
      <View>
        <Text>{code}</Text>
      </View>
    </View>
  );
}
