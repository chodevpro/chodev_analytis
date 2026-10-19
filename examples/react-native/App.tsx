import { useEffect } from 'react';
import { View, Text, Button } from 'react-native';
import {
  init,
  screen,
  track,
  appOpen,
  isFeatureEnabled,
  syncFlags,
} from '@chodev/analytics/react-native';

export default function MobileApp() {
  useEffect(() => {
    init({
      appId: 'cda_prod_demo123',
      appVersion: '1.2.0',
    });

    appOpen();
    screen('HomeScreen');
    syncFlags();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Chợ Dev Analytics Mobile</Text>
      <Button
        title="Bấm để test event"
        onPress={() => track('mobile_test_click', { screen: 'HomeScreen' })}
      />
      {isFeatureEnabled('new_chat_ui') && (
        <Text>Tính năng mới được kích hoạt từ xa!</Text>
      )}
    </View>
  );
}
