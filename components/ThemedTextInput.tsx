import { TextInput, TextInputProps, useColorScheme } from 'react-native';

interface ThemedTextInputProps extends TextInputProps {
  // Add any additional props here
}

export function ThemedTextInput(props: ThemedTextInputProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TextInput
      {...props}
      placeholderTextColor={isDark ? '#666' : '#999'}
      style={[
        {
          backgroundColor: isDark ? '#2C2C2C' : '#FFFFFF',
          color: isDark ? '#FFFFFF' : '#000000',
        },
        props.style,
      ]}
    />
  );
} 