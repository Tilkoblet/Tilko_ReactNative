import * as React from 'react';
import {
  StyleSheet,
  SafeAreaView,
  TextInput,
  View,
  Text,
  Button,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-community/picker';
import axios from 'axios';
import RNFS from 'react-native-fs';
import Certificate from 'react-native-certificate';

const pubUrl = 'https://api.tilko.net/api/Auth/GetPublicKey?ApiKey='; // Public Key API
const tilkoApiKey = 'API_KEY'; //  Tilko 홈페이지에 등록되어 있는 값

export default function TabTwoScreen() {
  const [apiKey, setApiKey] = React.useState(tilkoApiKey);
  const [selectedCert, setSelectedCert] = React.useState();
  const [publicKey, setPublicKey] = React.useState('');
  const [identityNumber1, setIdentityNumber1] = React.useState('');
  const [identityNumber2, setIdentityNumber2] = React.useState('');
  const [certPassword, setCertPassword] = React.useState('');
  const [endPoint, setEndPoint] = React.useState('api/v1.0/nhis/ggpab003m0105');
  const [certs, setCerts] = React.useState<any>([]);
  const [response, setResponse] = React.useState('');

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
              let result: any = await Certificate.getCertificate(
                subFolder.path + '/signCert.der'
              );

              if (Array.isArray(result)) {
                result = {
                  path: subFolder.path,
                  cn: result[1],
                  validDate: result[2],
                };
              } else {
                result.path = subFolder.path;
              }

              setCerts([...certs, result]);
            }
          }
        }
      }
    }).catch(() => {});
  };

  const getPublicKey = async () => {
    await readCertificates();
    return axios.get(pubUrl + apiKey).then((res) => {
      const { PublicKey } = res.data;
      setPublicKey(PublicKey);
      return res;
    });
  };

  const request = async () => {
    const aesKey = await Certificate.getAesKey('Bar12345Bar12345', publicKey);
    let { path } = JSON.parse(selectedCert || '{}');
    if (!path) {
      path = certs[0].path;
    }

    console.log('headers', {
      'API-KEY': apiKey,
      'ENC-KEY': aesKey,
    });

    axios
      .post(
        'https://api.tilko.net/' + endPoint,
        {
          CertFile: await Certificate.getEncryptedCert(path + '/signCert.der'),
          KeyFile: await Certificate.getEncryptedCert(path + '/signPri.key'),
          CertPassword: await Certificate.getEncryptedWithAES(certPassword),
          IdentityNumber: await Certificate.getEncryptedWithAES(
            identityNumber1 + identityNumber2,
        ),
      }, {
        headers: {
          'API-KEY': apiKey,
          'ENC-KEY': aesKey,
        },
      })
      .then((res) => {
        console.log('res.data', res.data);
        setResponse(JSON.stringify(res.data));
      });
  };

  React.useEffect(() => {
    getPublicKey();
  }, []);

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={styles.formItem}>
          <Text>API 키</Text>
          <TextInput
            style={styles.input}
            onChangeText={setApiKey}
            value={apiKey}
            placeholder="API 키"
          />
        </View>
        <View style={styles.formItem}>
          <Text>인증서 선택</Text>
          <Picker
            style={{ width: '100%', height: 150 }}
            onValueChange={(itemValue: any) => {
              setSelectedCert(itemValue);
            }}
            selectedValue={selectedCert}
          >
            {certs.map((cert: any) => {
              return (
                <Picker.Item
                  key={`${cert.cn}/${cert.validDate}`}
                  label={`${cert.cn} / ${cert.validDate}`}
                  value={JSON.stringify(cert)}
                />
              );
            })}
          </Picker>
        </View>
        <View style={styles.formItem}>
          <Text>주민등록번호</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <TextInput
              style={styles.number_input}
              onChangeText={setIdentityNumber1}
              value={identityNumber1}
              keyboardType="numeric"
            />
            <Text style={{ marginLeft: 5, marginRight: 5 }}>-</Text>
            <TextInput
              secureTextEntry={true}
              style={styles.number_input}
              onChangeText={setIdentityNumber2}
              value={identityNumber2}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.formItem}>
          <Text>인증서 비밀번호</Text>
          <TextInput
            secureTextEntry={true}
            style={styles.input}
            onChangeText={setCertPassword}
            value={certPassword}
          />
        </View>
        <View style={styles.formItem}>
          <Text>EndPoint</Text>
          <TextInput
            style={styles.input}
            onChangeText={setEndPoint}
            value={endPoint}
          />
        </View>
        <Button title={'호출 하기'} onPress={() => request()} />
        <Text>{response}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  formItem: {
    margin: 3,
    padding: 10,
  },
  input: {
    height: 40,
    borderWidth: 1,
    padding: 10,
    marginTop: 5,
  },
  number_input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    padding: 10,
    marginTop: 5,
  },
});
